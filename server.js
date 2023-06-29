const http = require('http');
const express = require('express');
const server = require('socket.io');
const argv = require('minimist')(process.argv.slice(2));
const path = require('path');
const config = require('./config.json');
let port;
let password;
let dev;

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
        consolelog("Starting server on port " + port + " with password " + password);
    }
});
