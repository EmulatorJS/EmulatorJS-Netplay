const argv = require('minimist')(process.argv.slice(2));
const path = require('path');
const cp = require('child_process');
const config = require('./config.json');
var port = config.port;
var password = config.password;

if(argv.p){
    port = argv.p;
}

if(argv.a){
    password = argv.a;
}

var server = cp.fork(path.join(__dirname, 'server.js'));
server.send({ function: 'start', port: port, password: password});

['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => process.on(signal, () => {
    server.send({ function: 'kill' });
    process.exit();
}));