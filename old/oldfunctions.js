io.on('connection', (socket) => {
    nofusers = io.engine.clientsCount;
    let url = socket.handshake.url;
    let args = transformArgs(url);
    let room = null;
    let extraData = JSON.parse(args.extra);

    function disconnect() {
        nofusers = io.engine.clientsCount;
        try {
            if (room === null) return;
            io.to(room.id).emit('user-disconnected', args.userid);
            for (let i=0; i<room.users.length; i++) {
                if (room.users[i].userid === args.userid) {
                    room.users.splice(i, 1);
                    break;
                }
            }
            if (!room.users[0]) {
                for (let i=0; i<global.rooms.length; i++) {
                    if (global.rooms[i].id === room.id) {
                        global.rooms.splice(i, 1);
                    }
                }
            } else {
                if (room.owner.userid === args.userid) {
                    room.owner = room.users[0];
                    room.owner.socket.emit('set-isInitiator-true', args.sessionid);
                }
                room.current = room.users.length;
            }
            socket.leave(room.id);
            room = null;
        } catch (e) {
            console.warn(e);
        }
    }
    socket.on('disconnect', disconnect);


    socket.on('close-entire-session', function(cb) {
        io.to(room.id).emit('closed-entire-session', args.sessionid, extraData);
        if (typeof cb === 'function') cb(true);
    })
    socket.on('open-room', function(data, cb) {
        room = new Room(data.extra.domain, data.extra.game_id, args.sessionid, data.extra.room_name, args.maxParticipantsAllowed, 1, data.password.trim(), args.userid, socket, data.extra, args.coreVer);
        global.rooms.push(room);
        extraData = data.extra;

        socket.emit('extra-data-updated', null, extraData);
        socket.emit('extra-data-updated', args.userid, extraData);

        socket.join(room.id);
        cb(true, undefined);
    })


    socket.on('check-presence', function(roomid, cb) {
        cb(getRoom(extraData.domain, extraData.game_id, roomid)!==null, roomid, null);
    })
    socket.on('join-room', function(data, cb) {

        room = getRoom(data.extra.domain, data.extra.game_id, data.sessionid);
        if (room === null) {
            cb(false, 'USERID_NOT_AVAILABLE');
            return;
        }
        if (room.current >= room.max) {
            cb(false, 'ROOM_FULL');
            return;
        }
        if (room.hasPassword && !room.checkPassword(data.password)) {
            cb(false, 'INVALID_PASSWORD');
            return;
        }

        room.users.forEach(user => {
            socket.to(room.id).emit("netplay", {
                "remoteUserId": user.userid,
                "message": {
                    "newParticipationRequest": true,
                    "isOneWay": false,
                    "isDataOnly": true,
                    "localPeerSdpConstraints": {
                        "OfferToReceiveAudio": false,
                        "OfferToReceiveVideo": false
                    },
                    "remotePeerSdpConstraints": {
                        "OfferToReceiveAudio": false,
                        "OfferToReceiveVideo": false
                    }
                },
                "sender": args.userid,
                "extra": extraData
            })
        })

        room.addUser({
            userid: args.userid,
            socket,
            extra: data.extra
        });

        socket.to(room.id).emit('user-connected', args.userid);

        socket.join(room.id);

        cb(true, null);
    })
    socket.on('set-password', function(password, cb) {
        if (room === null) {
            if (typeof cb === 'function') cb(false);
            return;
        }
        if (typeof password === 'string' && password.trim()) {
            room.password = password;
            room.hasPassword = true;
        } else {
            room.password = password.trim();
            room.hasPassword = false;
        }
        if (typeof cb === 'function') cb(true);
    });
    socket.on('changed-uuid', function(newUid, cb) {
        if (room === null) {
            if (typeof cb === 'function') cb(false);
            return;
        }
        for (let i=0; i<room.users.length; i++) {
            if (room.users[i].userid === args.userid) {
                room.users[i].userid = newUid;
                break;
            }
        }
        if (typeof cb === 'function') cb(true);
    });
    socket.on('disconnect-with', function(userid, cb) {
        //idk
        if (typeof cb === 'function') cb(true);
    })
    socket.on('netplay', function(msg) {
        if (room === null) return;
        const outMsg = JSON.parse(JSON.stringify(msg));
        outMsg.extra = extraData;
        socket.to(room.id).emit('netplay', outMsg);
        if (msg && msg.message && msg.message.userLeft === true) disconnect();
    })
    socket.on('extra-data-updated', function(msg) {
        if (room === null) return;
        let outMsg = JSON.parse(JSON.stringify(msg))
        outMsg.country = 'US';
        extraData = outMsg;

        for (let i=0; i<room.users.length; i++) {
            if (room.users[i].userid === args.userid) {
                room.users[i].extra = extraData;
                break;
            }
        }

        io.to(room.id).emit('extra-data-updated', args.userid, outMsg);
    })
    socket.on('get-remote-user-extra-data', function(id) {
        if (room === null) return;
        for (let i=0; i<room.users.length; i++) {
            if (room.users[i].userid === id) {
                socket.emit('extra-data-updated', room.users[i].extra);
            }
        }
    })
});
