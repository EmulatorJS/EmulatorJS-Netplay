let argv = {};
process.argv.forEach(function (val, index, array) {
    if (val.startsWith('-h') || val.startsWith('--help')){
        console.log("Usage: npm start [options]");
        console.log("Options:");
        console.log("  -p, --port     Specify the port number (default: 3000)");
        console.log("  -a, --password Set the password for authentication");
        console.log("  -d, --debug    Enable debug mode");
        console.log("  -h, --help     Display this help message");
        process.exit();
    }
    if (val.startsWith('-p') || val.startsWith('--port')){
        argv.p = array[index+1];
    }
    if (val.startsWith('-a') || val.startsWith('--password')){
        argv.a = array[index+1];
    }
    if (val.startsWith('-d') || val.startsWith('--debug')){
        argv.d = true;
    }
});
const path = require('path');
const cp = require('child_process');
const config = require('./config.json');
let port;
let password;
let dev;
if (argv.a){
    password = argv.a;
} else if (process.env.NETPLAY_PASSWORD) {
    password = process.env.NETPLAY_PASSWORD;
} else {
    password = config.password;
}

if (argv.p) {
    port = argv.p;
} else if (process.env.PORT) {
    port = process.env.PORT;
} else if (process.env.NETPLAY_PORT){
    port = process.env.NETPLAY_PORT;
} else {
    port = config.port;
}

if (argv.d) {
    dev = true;
} else if (process.env.NETPLAY_DEV){
    dev = process.env.NETPLAY_DEV;
} else {
    dev = config.dev;
}

var server = cp.fork(path.join(__dirname, 'server.js'));
server.send({ function: 'start', port: port, password: password, app: false, dev: dev});
