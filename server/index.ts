import express, { Express, Request, Response } from 'express';
import { createPeerServer, servePeerLib } from './webrtc';
import { authentication } from './auth';
import path from 'path';
import { hostname } from 'os';

const server: Express = express();
server.use(authentication);
createPeerServer(server, '/webrtc');
servePeerLib(server);
server.use(express.static('static', { index: 'index.html' }));

const port = process.env.PORT || 3000;


const listener = server.listen(port, () => {
    const addr = listener.address();
    console.log("Listening on: ");
    console.log(`\thttp://localhost:${port}`);
    console.log(`\thttp://${hostname()}:${port}`);
    // @ts-expect-error the address is defined
    console.log(`\thttp://${addr.family === 'IPv6' ? `[${addr.address}]` : addr.address}:${addr.port}`);
});

process.on('SIGINT', killServer);
process.on('SIGTERM', killServer);
process.on('SIGQUIT', killServer);

function killServer() {
    listener.close();
    process.exit(0);
}


export { killServer };
