const http = require('http');
const express = require('express');
const path = require('path');
const server = require('socket.io');
const config = require('./config.json');

process.on('message', function(m) {
    console.log(m);
});
//process.send({ foo: 'bar' });
//console.log("Starting server...");