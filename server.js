const http = require('http');
const express = require('express');
const server = require('socket.io');
const path = require('path');
const app = express();
let nofusers = 0;
let port;
let password;
let dev;
let appserver;
let window;
let server;

function startserver() {
    consolelog("Starting server on port " + port + " with password " + password);
    server = http.createServer(app);
    app.use(express.urlencoded());
    app.use(express.json());
    app.get('/', (req, res) => {
        const reject = () => {
            res.setHeader('www-authenticate', 'Basic')
            res.sendStatus(401)
        }
        if (!checkAuth(req.headers.authorization, password)) {
            return reject();
        }
        res.sendFile(path.join(__dirname + 'src' +'index.html'));
        if(appserver){
            process.send({ function: 'url', url: 'http://localhost:' + port});
        }
    });
}

function consolelog(message){
    if(dev){
        console.log(message);
    }
}

process.on('message', function(m) {
    console.log(m);
    if(m.function == 'start'){
        port = m.port;
        password = m.password;
        dev = m.dev;
        appserver = m.app;
        startserver();
    }
});
