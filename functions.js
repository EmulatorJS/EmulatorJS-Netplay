let dev;
global.rooms = [];

class Room {
    /**
     * Create a Room
     * @param {string} domain 
     * @param {number} game_id 
     * @param {string} sessionid 
     * @param {string} name 
     * @param {number} max 
     * @param {number} current 
     * @param {string} password 
     * @param {string} userid 
     * @param { import("socket.io").Socket } socket
     * @param {any} extra
     * 
     
     */
    constructor(domain, game_id, sessionid, name, max, current, password, userid, socket, extra) {
        /** @type string */
        this.domain = domain;
        /** @type number */
        this.game_id = game_id;
        /** @type string */
        this.sessionid = sessionid;
        /** @type string */
        this.name = name;
        /** @type number */
        this.max = max;
        /** @type number */
        this.current = current;
        /** @type string */
        this.password = password.trim();
        /** @type boolean */
        this.hasPassword = !!this.password;
        /** @type string */

        this.id = domain + ':' + game_id + ':' + sessionid;

        // define user type

        /**
         * @typedef {Object} User
         * @property {string} userid
         * @property { import("socket.io").Socket } socket
         * @property {any} extra 
         */

        /**
         * @type User
         */
        this.owner = {
            userid,
            socket,
            extra
        }
        /** @type User[] */
        this.users = [this.owner];
    }
    /**
     * Checks to see if the specified password matches this password
     * @param {string} password 
     * @returns 
     */
    checkPassword(password) {
        return password.trim() === this.password;
    }
    /**
     * Adds the user
     * @param {User} user 
     * 
     * @typedef {Object} User
     * @property {string} userid
     * @property { import("socket.io").Socket } socket
     * @property {any} extra 
     */
    addUser(user) {
        this.users.forEach(userr => {
            user.socket.emit('user-connected', userr.userid);
        })
        this.users.push(user);
        this.current++;
    }
}

function start(io, rooms, numusers, devv) {
    dev = devv;
    consolelog("Socket.io started");
    io.on('connection', (socket) => {
        updateusers();
        let url = socket.handshake.url;
        let args = transformArgs(url);
        let extraData = JSON.parse(args.extra);
        let room = null;
        
        socket.on('open-room', function(data, cb) {
            room = new Room(data.extra.domain, data.extra.game_id, args.sessionid, data.extra.room_name, args.maxParticipantsAllowed, 1, data.password.trim(), args.userid, socket, data.extra, args.coreVer);
            global.rooms.push(room);
            extraData = data.extra;
            socket.emit('extra-data-updated', args.userid, extraData);
            socket.join(room.id);
            
        })
        

    });

    function updateusers(){
        numusers.num = io.engine.clientsCount;
    }
}

function getRoom(domain, game_id, sessionid) {
    for (let i=0; i<global.rooms.length; i++) {
        if (global.rooms[i].id === domain + ':' + game_id + ':' + sessionid) {
            return global.rooms[i];
        }
    }
    return null;
}

function transformArgs(url) {
    var args = {}
    var idx = url.indexOf('?')
    if (idx != -1) {
        var s = url.slice(idx + 1)
        var parts = s.split('&')
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i]
            var idx2 = p.indexOf('=')
            args[decodeURIComponent(p.slice(0, idx2))] = decodeURIComponent(p.slice(idx2 + 1, s.length))
        }
    }
    return args
}

function consolelog(message){
    if(dev){
        console.log(message);
    }
}
module.exports = { getRoom, start, transformArgs };