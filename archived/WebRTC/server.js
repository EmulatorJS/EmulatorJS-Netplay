const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Express and Socket.io
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true
}));

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;

// Store rooms and their states
let rooms = {};

// Cleanup interval for empty rooms (every 60 seconds)
setInterval(() => {
    for (const sessionId in rooms) {
        if (Object.keys(rooms[sessionId].players).length === 0) {
            delete rooms[sessionId];
            console.log(`Cleaned up empty room ${sessionId}`);
        }
    }
}, 60000);

// API endpoint to list open rooms
app.get('/list', (req, res) => {
    const domain = req.query.domain;
    const gameId = req.query.game_id;
    console.log(`Received /list request: domain=${domain}, game_id=${gameId}`);
    const openRooms = Object.keys(rooms)
        .filter(sessionId => {
            const room = rooms[sessionId];
            return room &&
                   Object.keys(room.players).length < room.maxPlayers &&
                   room.domain === domain &&
                   String(room.gameId) === gameId;
        })
        .reduce((acc, sessionId) => {
            const room = rooms[sessionId];
            acc[sessionId] = {
                room_name: room.roomName,
                current: Object.keys(room.players).length,
                max: room.maxPlayers
            };
            return acc;
        }, {});
    console.log(`Returning open rooms: ${JSON.stringify(openRooms)}`);
    res.json(openRooms);
});

// Handle Socket.io connections
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle room creation
    socket.on('open-room', (data, callback) => {
        console.log(`Received open-room event: ${JSON.stringify(data)}`);
        let sessionId, playerId, roomName, gameId, domain, maxPlayers;
        if (data.extra) {
            sessionId = data.extra.sessionid;
            playerId = data.extra.userid || data.extra.playerId;
            roomName = data.extra.room_name;
            gameId = data.extra.game_id;
            domain = data.extra.domain;
            maxPlayers = data.maxPlayers || 4;
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
            maxPlayers: maxPlayers
        };
        socket.join(sessionId);
        socket.sessionId = sessionId;
        socket.playerId = playerId;
        console.log(`Room ${sessionId} created by ${playerId} with maxPlayers=${maxPlayers}`);

        io.to(sessionId).emit('users-updated', rooms[sessionId].players);
        console.log(`Sent initial users-updated to ${playerId} in room ${sessionId}`);

        callback(null);
    });

    // Handle room joining
    socket.on('join-room', (data, callback) => {
        const { sessionid: sessionId, userid: playerId } = data.extra || {};
        console.log(`Received join-room event: ${JSON.stringify(data)}`);
        if (!sessionId || !playerId) {
            return callback('Invalid data: sessionId and playerId required');
        }
        if (!rooms[sessionId]) {
            return callback('Room not found');
        }
        if (Object.keys(rooms[sessionId].players).length >= rooms[sessionId].maxPlayers) {
            return callback('Room full');
        }

        rooms[sessionId].players[playerId] = { ...data.extra, socketId: socket.id };
        socket.join(sessionId);
        socket.sessionId = sessionId;
        socket.playerId = playerId;
        console.log(`${playerId} joined room ${sessionId}`);
        io.to(sessionId).emit('users-updated', rooms[sessionId].players);

        // Initiate WebRTC signaling between owner and new players
        if (rooms[sessionId].owner && rooms[sessionId].owner !== socket.id) {
            rooms[sessionId].peers.push({ source: rooms[sessionId].owner, target: socket.id });
            io.to(rooms[sessionId].owner).emit("webrtc-signal", {
                target: socket.id,
                requestRenegotiate: true
            });
            console.log(`Added peer connection: ${rooms[sessionId].owner} -> ${socket.id} in room ${sessionId}`);
        }

        callback(null, rooms[sessionId].players);
    });

    // Handle WebRTC signaling (offers, answers, ICE candidates)
    socket.on('webrtc-signal', (data) => {
        try {
            const { target, candidate, offer, answer, requestRenegotiate } = data || {};
            if (!target && !requestRenegotiate) {
                throw new Error('Target ID missing unless requesting renegotiation');
            }
            console.log(`Received webrtc-signal from ${socket.id}:`, {
                target,
                offer: !!offer,
                answer: !!answer,
                candidate: !!candidate,
                requestRenegotiate
            });

            if (requestRenegotiate) {
                // Broadcast to the target (usually Player 2) to initiate WebRTC connection
                const targetSocket = io.sockets.sockets.get(target);
                if (targetSocket) {
                    targetSocket.emit('webrtc-signal', {
                        sender: socket.id,
                        requestRenegotiate: true
                    });
                    console.log(`Forwarded webrtc-signal (renegotiate) to ${target}`);
                } else {
                    console.log(`Target peer ${target} not found`);
                }
            } else {
                // Forward WebRTC signaling data to all peers in the room
                socket.to(socket.sessionId).emit('webrtc-signal', {
                    sender: socket.id,
                    candidate,
                    offer,
                    answer,
                    requestRenegotiate
                });
                console.log(`Broadcasted webrtc-signal to room ${socket.sessionId}`);
            }
        } catch (error) {
            console.error(`WebRTC signal error: ${error.message}`);
        }
    });

    // Relay game data messages
    socket.on('data-message', (data) => {
        if (socket.sessionId) {
            console.log(`Broadcasting data-message in room ${socket.sessionId}: ${JSON.stringify(data)}`);
            socket.to(socket.sessionId).emit('data-message', data);
        }
    });

    // Relay game snapshots
    socket.on('snapshot', (data) => {
        if (socket.sessionId) {
            console.log(`Broadcasting snapshot in room ${socket.sessionId}`);
            socket.to(socket.sessionId).emit('snapshot', data);
        }
    });

    // Relay inputs via Socket.io (fallback if WebRTC data channel fails)
    socket.on('input', (data) => {
        if (socket.sessionId) {
            console.log(`Relaying input from ${socket.id} in room ${socket.sessionId}: ${JSON.stringify(data)}`);
            socket.to(socket.sessionId).emit('input', data);
        }
    });

    // Handle player disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        if (socket.sessionId && socket.playerId) {
            const sessionId = socket.sessionId;
            const playerId = socket.playerId;
            if (rooms[sessionId]) {
                delete rooms[sessionId].players[playerId];
                console.log(`Player ${playerId} left room ${sessionId}`);

                rooms[sessionId].peers = rooms[sessionId].peers.filter(peer =>
                    peer.source !== socket.id && peer.target !== socket.id
                );
                console.log(`Updated peers for room ${sessionId}: ${JSON.stringify(rooms[sessionId].peers)}`);

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

                        rooms[sessionId].peers = rooms[sessionId].peers.map(peer => {
                            if (peer.source === socket.id) {
                                return { source: newOwnerId, target: peer.target };
                            }
                            return peer;
                        });
                        console.log(`Reassigned peers to new owner in room ${sessionId}: ${JSON.stringify(rooms[sessionId].peers)}`);

                        // Only emit renegotiation if there are peers to connect to
                        if (rooms[sessionId].peers.length > 0) {
                            io.to(newOwnerId).emit("webrtc-signal", {
                                target: rooms[sessionId].peers[0].target,
                                requestRenegotiate: true
                            });
                        }
                        io.to(sessionId).emit('users-updated', rooms[sessionId].players);
                    }
                }
            }
        }
    });
});

// Start the server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
