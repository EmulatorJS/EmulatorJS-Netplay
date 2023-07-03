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
let nofusers = {num: 3};
let rooms = {room: []};
let port;
let password;
let dev;
let appserver;
let server;
let io;

function checkAuth(authorization, passwordforserver) {
    if (!authorization) return false;
    const [username, password] = Buffer.from(authorization.replace('Basic ', ''), 'base64').toString().split(':')
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
        if (!checkAuth(req.headers.authorization, password)) {
            return reject();
        }
        res.sendFile(path.join(__dirname + '/src/' +'index.html'));
    });
    app.get('/img/:imageName', function(req, res) {
        const image = req.params['imageName'];
        try {
            res.sendFile(path.join(__dirname + '/src/img/' + image));
        } catch (err) {
            res.sendStatus(401)
        }
    });
    app.post('/status', (req, res) => {
        const reject = () => {
            res.setHeader('www-authenticate', 'Basic')
            res.sendStatus(401)
        }
        if (!checkAuth(req.headers.authorization, password)) {
            return reject();
        }
        res.end('{ "port": ' + port + ', "password": "' + password + '", "nofusers": ' + nofusers.num + ' }');
    });
    app.post('/interface', (req, res) => {
        const reject = () => {
            res.setHeader('www-authenticate', 'Basic')
            res.sendStatus(401)
        }
        if (!checkAuth(req.headers.authorization, password)) {
            return reject();
        }
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
    });
    app.post('/check', (req, res) => {
        const reject = () => {
            res.setHeader('www-authenticate', 'Basic')
            res.sendStatus(401)
        }
        if (!checkAuth(req.headers.authorization, password)) {
            return reject();
        }
        res.end(mainserver.toString());
    });
    app.post('/numusers', (req, res) => {
        const reject = () => {
            res.setHeader('www-authenticate', 'Basic')
            res.sendStatus(401)
        }
        if (!checkAuth(req.headers.authorization, password)) {
            return reject();
        }
        res.end('{ "users": ' + nofusers.num + " }");
    });
    app.post('/startstop', (req, res) => {
        const reject = () => {
            res.setHeader('www-authenticate', 'Basic');
            res.sendStatus(401);
        }
        if (!checkAuth(req.headers.authorization, password)) {
            return reject();
        }
        if (req.body.function === "stop") {
            mainserver = false;
            res.end('true');
            stopnetplay();
        } else {
            mainserver = true;
            res.end('true');
            startnetplay();
        }
    });
    app.get('/list', function(req, res) {
        if(mainserver){
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            let args = transformArgs(req.url)
            if (!args.game_id || !args.domain || !args.coreVer) {
                res.end('{}');
                return;
            }
            args.game_id = parseInt(args.game_id);
            args.coreVer = parseInt(args.coreVer);
            let rv = {};
            for (let i=0; i<rooms.room.length; i++) {
                if (rooms.room[i].domain !== args.domain ||
                    rooms.room[i].game_id !== args.game_id ||
                    rooms.room[i].coreVer !== args.coreVer) continue;
                rv[rooms.room[i].sessionid] = {
                    owner_name: rooms.room[i].owner.extra.name,
                    room_name: rooms.room[i].name,
                    country: 'US',
                    max: rooms.room[i].max,
                    current: rooms.room[i].current,
                    password: (rooms.room[i].password.trim() ? 1 : 0)
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
        }
    });
    netplay.start(io, rooms, nofusers, dev);
}

function stopnetplay(){
    consolelog("Stopping Netplay");
    io.close();
    startserver();
}

function consolelog(message){
    if(dev){
        console.log(message);
    }
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

process.on('message', function(m) {
    console.log(m);
    if(m.function == 'start'){
        port = m.port;
        password = m.password;
        dev = m.dev;
        appserver = m.app;
        startserver();
        consolelog("Starting server on port " + (port || 3000) + " with password " + password);
    }else if(m.function == 'kill'){
        process.exit();
    }
});
