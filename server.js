const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const os = require('os');
const netplay = require("./functions.js");
let interfaces = os.networkInterfaces();
let mainserver = true;
let addresses = [];
let nofusers = {num: 0};
let port;
let password;
let dev;
let appserver;
let server;
let io;

function checkAuth(req, passwordforserver) {
    if (req.query.password === passwordforserver) {
        return true;
    }
    if (!req.headers.authorization) {
        return false;
    }
    const [username, password] = Buffer.from(req.headers.authorization.replace('Basic ', ''), 'base64').toString().split(':')
    return username === 'admin' && password === passwordforserver;
}

function startserver() {
    server = http.createServer(app);
    app.use(express.json());
    app.get('/', (req, res) => {
        const reject = () => {
            res.setHeader('www-authenticate', 'Basic')
            res.sendStatus(401)
        }
        if (!checkAuth(req, password)) {
            return reject();
        }
        res.sendFile(path.join(__dirname + '/src/' +'index.html'));
    });
    app.get('/loading.html', (req, res) => {
        res.sendFile(path.join(__dirname + '/src/' +'loading.html'));
    });
    app.get('/img/:imageName', function(req, res) {
        const image = req.params['imageName'];
        try {
            res.sendFile(path.join(__dirname + '/src/img/' + image));
        } catch (err) {
            res.sendStatus(401)
        }
    });
    app.post('/api', (req, res) => {
        const reject = () => {
            res.setHeader('www-authenticate', 'Basic')
            res.sendStatus(401)
        }
        if (!checkAuth(req, password)) {
            return reject();
        }
        if (req.body.function === "status") {
            res.end('{ "status": ' + mainserver.toString() + ', "port": ' + port + ', "password": "' + password + '", "nofusers": ' + nofusers.num + ' }'); 
        }else if(req.body.function === "interface"){
            for (let k in interfaces) {
                for (let k2 in interfaces[k]) {
                    let address = interfaces[k][k2];
                    if (address.family === 'IPv4') {
                        addresses.push("http://"+address.address+":"+port+"/");
                    }
                }
            }
            addresses.push("http://localhost:"+port+"/");
            res.end('{ "interfaces": ' + JSON.stringify(addresses) + ' }');
        }else if(req.body.function === "check"){
            res.end(mainserver.toString());
        }else if(req.body.function === "nofusers"){
            res.end('{ "users": ' + nofusers.num + " }");
        }else if(req.body.function === "stop"){
            mainserver = false;
            res.end('true');
            stopnetplay();
        }else if(req.body.function === "start"){
            mainserver = true;
            res.end('true');
            startnetplay();
        }
    });
    app.get('/list', function(req, res) {
        if(mainserver){
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            let args = netplay.transformArgs(req.url)
            if (!args.game_id || !args.domain) {
                res.end('{}');
                return;
            }
            args.game_id = parseInt(args.game_id);
            let rv = {};
            for (let i=0; i<global.rooms.length; i++) {
                if (global.rooms[i].domain !== args.domain ||
                    global.rooms[i].game_id !== args.game_id) continue;
                rv[global.rooms[i].sessionid] = {
                    owner_name: global.rooms[i].owner.extra.name,
                    room_name: global.rooms[i].name,
                    max: global.rooms[i].max,
                    current: global.rooms[i].current,
                    password: (global.rooms[i].password.trim() ? 1 : 0)
                }
            }
            res.end(JSON.stringify(rv));
        }
    })
    server.listen(port || 3000, '0.0.0.0', () => {
        if(appserver){
            process.send({ function: 'url', url: 'http://localhost:' + port});
        }
        if(mainserver){
            startnetplay();
        }
    });
}

function startnetplay(){
    consolelog("Starting Netplay");
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            credentials: true
        },
        maxHttpBufferSize: 1e8
    });
    netplay.start(io, rooms, nofusers, dev);
}

function stopnetplay(){
    consolelog("Stopping Netplay");
    io.close();
    startserver();
}

function consolelog(message, smallmessage){
    if (dev){
        console.log(message);
    } else if (smallmessage){
        console.log(smallmessage);
    }
}

process.on('message', function(m) {
    consolelog(m);
    if(m.function == 'start'){
        port = m.port;
        password = m.password;
        dev = m.dev;
        appserver = m.app;
        startserver();
        consolelog("Starting server on port " + (port || 3000) + " with password " + password, "Starting server");
    }else if(m.function == 'kill'){
        consolelog("Killing server", "Killing server");
        process.exit();
    }
});
