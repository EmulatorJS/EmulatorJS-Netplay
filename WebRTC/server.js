const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true,
}));

const io = socketIo(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3000;
let rooms = {};

setInterval(() => {
  for (const sessionId in rooms) {
    if (Object.keys(rooms[sessionId].players).length === 0) {
      delete rooms[sessionId];
      console.log(`Cleaned up empty room ${sessionId}`);
    }
  }
}, 60000);

app.get('/list', (req, res) => {
  const domain = req.query.domain;
  const gameId = req.query.game_id;
  const openRooms = Object.keys(rooms)
    .filter((sessionId) => {
      const room = rooms[sessionId];
      return (
        room &&
        Object.keys(room.players).length < room.maxPlayers &&
        room.domain === domain &&
        String(room.gameId) === gameId
      );
    })
    .reduce((acc, sessionId) => {
      const room = rooms[sessionId];
      const ownerPlayerId = Object.keys(room.players).find(
        (playerId) => room.players[playerId].socketId === room.owner
      );
      const playerName = ownerPlayerId ? room.players[ownerPlayerId].player_name : 'Unknown';
      acc[sessionId] = {
        room_name: room.roomName,
        current: Object.keys(room.players).length,
        max: room.maxPlayers,
        player_name: playerName,
        hasPassword: !!room.password,
      };
      return acc;
    }, {});
  res.json(openRooms);
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('open-room', (data, callback) => {
    let sessionId, playerId, roomName, gameId, domain, maxPlayers, playerName, roomPassword;
    if (data.extra) {
      sessionId = data.extra.sessionid;
      playerId = data.extra.userid || data.extra.playerId;
      roomName = data.extra.room_name;
      gameId = data.extra.game_id;
      domain = data.extra.domain;
      maxPlayers = data.maxPlayers || 4;
      playerName = data.extra.player_name || 'Unknown';
      roomPassword = data.extra.room_password || 'none';
    }
    if (!sessionId || !playerId) {
      return callback('Invalid data: sessionId and playerId required');
    }
    if (rooms[sessionId]) {
      return callback('Room already exists');
    }
    rooms[sessionId] = {
      owner: socket.id,
      players: { [playerId]: { ...data.extra, socketId: socket.id } },
      peers: [],
      roomName: roomName || `Room ${sessionId}`,
      gameId: gameId || 'default',
      domain: domain || 'unknown',
      password: data.password || null,
      maxPlayers: maxPlayers,
    };
    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.playerId = playerId;
    console.log(
      `Room ${sessionId} (Name: ${roomName}) created by ${playerName} (ID: ${playerId}), Password: ${roomPassword}, maxPlayers=${maxPlayers}`
    );
    io.to(sessionId).emit('users-updated', rooms[sessionId].players);
    callback(null);
  });

  socket.on('join-room', (data, callback) => {
    const { sessionid: sessionId, userid: playerId, player_name: playerName = 'Unknown' } = data.extra || {};
    
    if (!sessionId || !playerId) {
      if (typeof callback === 'function') callback('Invalid data: sessionId and playerId required');
      return;
    }

    const room = rooms[sessionId];
    if (!room) {
      if (typeof callback === 'function') callback('Room not found');
      return;
    }

    const roomName = room.roomName || 'Unknown';

    const roomPassword = data.password || null;
    if (room.password && room.password !== roomPassword) {
      if (typeof callback === 'function') callback('Incorrect password');
      return;
    }
    
    if (Object.keys(room.players).length >= room.maxPlayers) {
      if (typeof callback === 'function') callback('Room full');
      return;
    }
    
    room.players[playerId] = { ...data.extra, socketId: socket.id };
    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.playerId = playerId;
    
    console.log(`${playerName} (ID: ${playerId}) joined room ${sessionId} (Name: ${roomName})`);
    
    io.to(sessionId).emit('users-updated', room.players);
    
    if (typeof callback === 'function') {
      callback(null, room.players);
    }
  });

  socket.on('leave-room', () => {
    console.log(`Player requested to leave room: ${socket.id}`);
    if (socket.sessionId && socket.playerId) {
      const sessionId = socket.sessionId;
      const playerId = socket.playerId;
      const roomName = rooms[sessionId]?.roomName || 'Unknown';
      if (rooms[sessionId]) {
        delete rooms[sessionId].players[playerId];
        console.log(`Player ${playerId} left room ${sessionId}`);
        rooms[sessionId].peers = rooms[sessionId].peers.filter(
          (peer) => peer.source !== socket.id && peer.target !== socket.id
        );
        io.to(sessionId).emit('users-updated', rooms[sessionId].players);
        if (Object.keys(rooms[sessionId].players).length === 0) {
          delete rooms[sessionId];
          console.log(`Room ${sessionId} closed - no players left`);
        } else if (socket.id === rooms[sessionId].owner) {
          const remainingPlayers = Object.keys(rooms[sessionId].players);
          if (remainingPlayers.length > 0) {
            const newOwnerId = rooms[sessionId].players[remainingPlayers[0]].socketId;
            rooms[sessionId].owner = newOwnerId;
            console.log(`New owner for room ${sessionId}: ${newOwnerId}`);
            rooms[sessionId].peers = rooms[sessionId].peers.map((peer) => {
              if (peer.source === socket.id) {
                return { source: newOwnerId, target: peer.target };
              }
              return peer;
            });
            if (rooms[sessionId].peers.length > 0) {
              io.to(newOwnerId).emit('webrtc-signal', {
                target: rooms[sessionId].peers[0].target,
                requestRenegotiate: true,
              });
            }
            io.to(sessionId).emit('users-updated', rooms[sessionId].players);
          }
        }
      }
      socket.leave(sessionId);
      delete socket.sessionId;
      delete socket.playerId;
    }
  });

  socket.on('webrtc-signal', (data) => {
    try {
      const { target, candidate, offer, answer, requestRenegotiate } = data || {};
      if (!target && !requestRenegotiate) {
        throw new Error('Target ID missing unless requesting renegotiation');
      }
      if (requestRenegotiate) {
        const targetSocket = io.sockets.sockets.get(target);
        if (targetSocket) {
          targetSocket.emit('webrtc-signal', {
            sender: socket.id,
            requestRenegotiate: true,
          });
        }
      } else {
        io.to(target).emit('webrtc-signal', {
          sender: socket.id,
          candidate,
          offer,
          answer,
        });
      }
    } catch (error) {
      console.error(`WebRTC signal error: ${error.message}`);
    }
  });

  socket.on('data-message', (data) => {
    if (socket.sessionId) {
      socket.to(socket.sessionId).emit('data-message', data);
    }
  });

  socket.on('snapshot', (data) => {
    if (socket.sessionId) {
      socket.to(socket.sessionId).emit('snapshot', data);
    }
  });

  socket.on('input', (data) => {
    if (socket.sessionId) {
      socket.to(socket.sessionId).emit('input', data);
}
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    if (socket.sessionId && socket.playerId) {
      const sessionId = socket.sessionId;
      const playerId = socket.playerId;
      if (rooms[sessionId]) {
        delete rooms[sessionId].players[playerId];
        console.log(`Player ${playerId} left room ${sessionId}`);
        rooms[sessionId].peers = rooms[sessionId].peers.filter(
          (peer) => peer.source !== socket.id && peer.target !== socket.id
        );
        io.to(sessionId).emit('users-updated', rooms[sessionId].players);
        if (Object.keys(rooms[sessionId].players).length === 0) {
          delete rooms[sessionId];
          console.log(`Room ${sessionId} closed - no players left`);
        } else if (socket.id === rooms[sessionId].owner) {
          const remainingPlayers = Object.keys(rooms[sessionId].players);
          if (remainingPlayers.length > 0) {
            const newOwnerId = rooms[sessionId].players[remainingPlayers[0]].socketId;
            rooms[sessionId].owner = newOwnerId;
            console.log(`New owner for room ${sessionId}: ${newOwnerId}`);
            rooms[sessionId].peers = rooms[sessionId].peers.map((peer) => {
              if (peer.source === socket.id) {
                return { source: newOwnerId, target: peer.target };
              }
              return peer;
            });
            if (rooms[sessionId].peers.length > 0) {
              io.to(newOwnerId).emit('webrtc-signal', {
                target: rooms[sessionId].peers[0].target,
                requestRenegotiate: true,
              });
            }
            io.to(sessionId).emit('users-updated', rooms[sessionId].players);
          }
        }
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));