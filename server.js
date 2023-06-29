const http = require('http');
const express = require('express');
const server = require('socket.io');
const argv = require('minimist')(process.argv.slice(2));
const path = require('path');
const config = require('./config.json');
let port = config.port;
let password = config.password;
let dev = false;

if(argv.p){
    port = argv.p;
}

if(argv.a){
    password = argv.a;
}

if(argv.h || argv._.includes('help')){
    console.log("Usage: npm start -- [-p port] [-a password]");
    process.exit();
}

if(argv.d){
    dev = true;
    console.log("Starting server on port " + port + " with password " + password);
}
console.dir(process.argv)
process.on('message', function(m) {
    if(dev){
    
    }
    console.log(m);
});
//process.send({ foo: 'bar' });
