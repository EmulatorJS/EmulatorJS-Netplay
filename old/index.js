let argv;
try {
    argv = require('minimist')(process.argv.slice(2));
} catch(e) {
    argv = {};
}
const path = require('path');
const cp = require('child_process');
const config = require('../config.json');
let port;
let password;
let dev;

if (process.env.NETPLAY_PASSWORD) {
    password = process.env.NETPLAY_PASSWORD;
} else if (argv.a){
    password = argv.a;
} else {
    password = config.password;
}

if (process.env.NETPLAY_PORT) {
    port = process.env.NETPLAY_PORT;
} else if (process.env.PORT) {
    port = process.env.PORT;
} else if (argv.p){
    port = argv.p;
} else {
    port = config.port;
}

if (process.env.NETPLAY_DEV) {
    dev = process.env.NETPLAY_DEV;
} else if (argv.d){
    dev = true;
} else {
    dev = config.dev;
}

if (argv.h || (argv._ && argv._.includes('help'))) {
    console.log("Usage: npm start -- [-p port] [-a password]");
    process.exit();
}

var server = cp.fork(path.join(__dirname, 'server.js'));
server.send({ function: 'start', port: port, password: password, app: false, dev: dev});
