const http = require('http');
const express = require('express');
const Server = require('socket.io');
const path = require('path');
const app = express();
let nofusers = 0;
let port;
let password;
let dev;
let appserver;
let server;

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
    server.listen(port || 3000, '0.0.0.0', () => {
        consolelog("Starting server on port " + (port || 3000) + " with password " + password);
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
    }else if(m.function == 'kill'){
        process.exit();
    }
});
