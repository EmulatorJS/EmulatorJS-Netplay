function EJS_NETPLAY(createRoom, room, name, socketURL, id, maxUsers, password, requestedSite) {
    if ([true,false,1,0].indexOf(createRoom) === -1) {
        throw new TypeError("Invalid value for option createRoom. Allowed options are: true, false, 0, and 1.");
    }
    if (typeof room !== "string") {
        throw new TypeError("Invalid type for option room. Allowed types are String.");
    }
    room = room.trim();
    if (room.length === 0) {
        throw new TypeError("Invalid value for option room. Length (trimmed) must be greater than 0.");
    }
    if (typeof name !== "string") {
        throw new TypeError("Invalid type for option name. Allowed types are String.");
    }
    name = name.trim();
    if (name.length === 0) {
        throw new TypeError("Invalid value for option name. Length (trimmed) must be greater than 0.");
    }
    const socketUrl = new URL(socketURL); //This will throw the error for us
    if (["wss:", "ws:"].indexOf(socketUrl.protocol) === -1) {
        throw new TypeError("Invalid value for option socketURL. Protocol must be 'wss:' or 'ws:'.");
    }
    if (typeof id !== 'number') {
        throw new TypeError("Invalid type for argument gameID. Allowed types are Number.");
    }
    let site;
    if (requestedSite) {
        if (typeof requestedSite !== "string") {
            console.warn("Invalid type for argument requestedSite. Using "+window.location.host);
            site = window.location.host;
        } else {
            site = requestedSite;
        }
    } else {
        site = window.location.host;
    }
    if (password !== undefined && password !== null && typeof password !== 'string') {
        throw new TypeError("Password must be undefined, null, or a string.");
    }
    if (typeof maxUsers !== 'number') {
        throw new TypeError("Max Users must be a number.");
    }
    this.owner = createRoom;
    this.opts = {
        createRoom,
        room,
        name,
        socketURL,
        id,
        site,
        maxUsers,
        password
    }
}

EJS_NETPLAY.prototype = {
    init: async function() {
        this.joined = false;
        this.error = false;
        this.users = [];
        this.pendingInputs = [];
        this.paused = false;
        this.inputsData = {};
        this.userFrames = [null,null,null,null];
        this.frameWaitDiff = null;
        this.currentFrame = 0;
        await this.openSocket(this.opts.socketURL);
        if (this.opts.createRoom) {
            this.createRoom(this.opts.room, this.opts.name, this.opts.id, this.opts.site, this.opts.maxUsers, this.opts.password);
        } else {
            this.joinRoom(this.opts.room, this.opts.name, this.opts.id, this.opts.site, this.opts.password);
        }
    },
    isOwner: function() {
        return this.owner;
    },
    state: {
        pause: function() {
            this.socket.send('pause');
            this.paused = true;
        },
        play: function() {
            this.socket.send('play');
            this.paused = false;
        },
        loaded: async function() {
            const state = await this.listeners.savestate();
            this.socket.send("incoming_save_state:"+state.byteLength);
            this.socket.send(state);
        },
        restart: function() {
            //this.socket.send('restart');
        }
    },
    paused: false,
    pause: function() {
        this.paused = true;
        this.Module.pauseMainLoop();
    },
    play: function() {
        this.paused = false;
        this.Module.resumeMainLoop();
    },
    restart: function() {
        this.listeners.restart();
    },
    listeners: {},
    callListener: function(type) {
        if (this.listeners[type.toLowerCase()]) {
            this.listeners[type.toLowerCase()]();
        }
    },
    onError: function(e) {
        if (this.listeners.error) {
            this.listeners.error(e);
        }
        this.onClose();
        try {
            this.socket.close();
        } catch(e) {}
    },
    on: function(event, cb) {
        if (typeof event !== 'string') {
            throw new TypeError("Invalid type for event argument. Allowed types are String.");
        }
        if (typeof cb !== 'function') {
            throw new TypeError("Invalid type for cb argument. Allowed types are Function.");
        }
        this.listeners[event.toLowerCase()] = cb;
    },
    addEventListener: function(event, cb) {
        this.on(event, cb);
    },
    openSocket: function(socketURL) {
        return new Promise((resolve, reject) => {
            this.socket = new WebSocket(socketURL);
            this.socket.binaryType = "arraybuffer";
            this.socket.addEventListener('open', resolve);
            this.socket.addEventListener('error', this.onError.bind(this));
            this.socket.addEventListener('close', this.onClose.bind(this));
            this.socket.addEventListener('message', this.onMessage.bind(this));
        })
    },
    onClose: function(e) {
        this.callListener("close");
    },
    quit: function() {
        try {
            this.socket.close();
        } catch(e) {}
        this.onClose();
    },
    incomingSaveState: null,
    onMessage: async function(e) {
        //console.log(e);
        if (e.data && this.joined === false && typeof e.data === "string") {
            if (e.data === "Connected") {
                this.joined = true;
                this.users.push(this.opts.name);
                this.callListener("connected");
            } else {
                this.joined = false;
                this.error = true;
                this.onError(e.data);
            }
            return;
        } else if (this.joined === false) {
            this.error = true;
            this.onError();
            return;
        } else if (e.data && typeof e.data === "string") {
            if (e.data.startsWith("User Connected")) {
                if (this.owner) { //Lets have the owner keep track of all this stuff
                    const name = e.data.substring(16).trim();
                    this.callListener("userdatachanged");
                    this.users.push(name);
                    this.socket.send("userDataChanged:"+JSON.stringify(this.users));
                    const state = await this.listeners.savestate();
                    this.socket.send("incoming_save_state:"+state.byteLength);
                    this.socket.send(state);
                    setTimeout(() => {
                        this.socket.send('play');
                    }, 1000)
                }
            } else if (e.data.startsWith("User Disonnected")) {
                if (this.owner) {
                    const name = e.data.substring(18).trim();
                    this.callListener("userdatachanged");
                    const index = array.indexOf(name);
                    if (index > -1) {
                        this.users.splice(index, 1);
                    }
                    this.socket.send("userDataChanged:"+JSON.stringify(this.users));
                }
            } else if (e.data.startsWith("userDataChanged:")) {
                let data;
                try {
                    data = JSON.parse(e.data.substring(16));
                } catch(e) {
                    console.warn("Error parsing updated user data.");
                    return;
                }
                this.users = data;
                this.callListener("userdatachanged");
            } else if (e.data.startsWith("sync-control:")) {
               // if (!this.owner) return;
                let data;
                const userNum = this.users.indexOf(this.opts.name);
                try {
                    data = JSON.parse(e.data.substring(13));
                } catch(e) {
                    console.warn("Error parsing sync control data.");
                    return;
                }
                
                data.forEach((input) => {
                    const frame = this.currentFrame;//_0x54e0fd
                    const dataFrame = input.frame;//_0x249303
                    const player = input.player;//_0x25a5c4
                    const keyData = input.data;//_0x2b3afd
                    this.inputsData[dataFrame] || (this.inputsData[dataFrame] = []);
                    if (player && frame === dataFrame) {
                        this.listeners.keychanged(input);
                    }
                    if (this.owner && player) {
                        this.inputsData[frame] || (this.inputsData[frame] = []);
                        this.inputsData[frame].push(input);
                        this.listeners.keychanged(input);
                        if (!this.paused && frame - 10 >= dataFrame) {
                            this.pause();
                            this.wait = true;
                            setTimeout(() => {
                                this.play()
                                this.wait = false;
                            }, 48)
                        }
                    } else if (player) {
                        this.inputsData[dataFrame].push(input);
                        this.inputsData[frame] && this.play();
                        if (frame + 10 <= dataFrame && dataFrame > 100) {
                            this.socket.send("short-pause:"+player);
                        }
                    }
                    
                })
                
            } else if (e.data.startsWith('incoming_save_state')) {
                this.incomingSaveState = {length: parseInt(e.data.substring(20)), data:[], recieved:0};
            } else if (e.data.startsWith("short-pause:")) {
                if (parseInt(e.data.substring(12)) === this.users.indexOf(this.opts.name) && !this.paused) {
                    this.pause();
                    this.wait = true;
                    setTimeout(() => {
                        this.play();
                        this.wait = false;
                    }, 48)
                }
            } else if (e.data === 'pause') {
                this.pause();
            } else if (e.data === 'play') {
                this.play();
            } else if (e.data === 'restart') {
                if (this.owner) return;
                if (!this.owner) this.restart();
            } else if(e.data.startsWith('sync-mem') && this.owner) {
                //let player = parseInt(e.data.substring(8));
                //this.wait = true;
                this.sendState();
            }
        } else if (e.data && typeof e.data !== 'string') {
            if (this.incomingSaveState !== null) {
                this.incomingSaveState.data.push(e.data);
                this.incomingSaveState.recieved += e.data.byteLength;
                if (this.incomingSaveState.recieved >= this.incomingSaveState.length) {
                    const state = new Uint8Array(await (new Blob(this.incomingSaveState.data)).arrayBuffer());
                    this.listeners.loadstate(state);
                    this.pendingInputs = [];
                    this.currentFrame = 0;
                    this.incomingSaveState = null;
                    this.play();
                    this.paused = false;
                    this.inputsData = {};
                }
            }
        }
    },
    sendState: async function() {
        const state = await this.listeners.savestate();
        this.listeners.loadstate(state);
        this.inputsData = {};
        this.socket.send("incoming_save_state:"+state.byteLength);
        this.socket.send(state);
    },
    keyChanged: function(data) {
        const frame = this.currentFrame;
        let message = {};
        message.data = data;
        message.frame = frame;
        message.player = this.users.indexOf(this.opts.name);
        if (this.owner) {
            this.inputsData[frame] || (this.inputsData[frame] = []);
            this.inputsData[frame].push(message);
            this.listeners.keychanged(message);
        } else {
            this.socket.send("sync-control:"+JSON.stringify([message]));
        }
    },
    pendingInputs: [],
    users: [],
    userFrames: [null, null, null, null],
    getUsers: function() {
        return this.users;
    },
    currentFrame: 0,
    postMainLoop: function() {
        if (!this.paused) this.currentFrame++;
        
        if (this.owner) {
            let data = [];
            for (let i = this.currentFrame - 1; i < this.currentFrame; i++) {
                if (this.inputsData[i]) {
                    this.inputsData[i].forEach(function(value) {
                        data.push(value);
                    })
                } else {
                    data.push({frame:i});
                }
            }
            if (data.length !== 0) this.socket.send("sync-control:"+JSON.stringify(data));
            Object.keys(this.inputsData).forEach((value) => {
                if (value < this.currentFrame - 50) {
                    this.inputsData[value] = null;
                    delete this.inputsData[value];
                }
            });
            
        } else {
            /*
            if (this.coreOptionData[this.currentFrame]) {
                const _0x2c1832 = this.coreOptionData[this.currentFrame].key,
                      _0x4fd0cc = this.coreOptionData[this.currentFrame].value;
                _0x2593da.updateCoreOptions.call(_0x17edbf, _0x2c1832, _0x4fd0cc), delete this.coreOptionData[this.currentFrame];
            }
            */
            if (this.currentFrame <= 0 || this.inputsData[this.currentFrame]) {
                this.wait = false;
                this.play();
                let data = this.inputsData[this.currentFrame];
                this.inputsData[this.currentFrame] = null;
                delete this.inputsData[this.currentFrame];
                data || (data = []);
                data.forEach((value) => {
                    this.listeners.keychanged(value);
                });
            } else {
                
                var _0x3a10d1 = false,
                    _0x42763c = Object.keys(this.inputsData);
                0 == _0x42763c.length && (_0x3a10d1 = true);
                for (var _0x58af15 = 0; _0x58af15 < _0x42763c.length; _0x58af15++) {
                    if (_0x42763c[_0x58af15] > this.currentFrame) {
                        console.log('lost', this.currentFrame);
                        _0x3a10d1 = true;
                        break;
                    }
                }
                if (_0x3a10d1) {
                    this.wait || (!this.currDate || this.currDate < new Date().valueOf() - 3000) && (() => {
                        this.inputsData = {};
                        this.currDate = new Date().valueOf();
                        this.socket.send('sync-mem:'+this.users.indexOf(this.opts.name));
                    })();
                    
                } else {
                    this.wait = true;
                    this.pause();
                }
            }
            Object.keys(this.inputsData).forEach((value) => {
                if (value < this.currentFrame - 50) {
                    this.inputsData[value] = null;
                    delete this.inputsData[value];
                }
            });
        }
        
    },
    createRoom: function(roomName, userName, id, site, maxUsers, password) {
        this.socket.send('OpenRoom\n'+roomName+'\n'+userName+'\n'+site+'\n'+id+'\n'+maxUsers+'\n'+(password||''));
    },
    joinRoom: function(roomName, userName, id, site, password) {
        this.socket.send('JoinRoom\n'+roomName+'\n'+userName+'\n'+site+'\n'+id+'\n'+(password||''));
    }
}