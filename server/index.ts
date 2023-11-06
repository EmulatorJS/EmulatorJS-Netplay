import express, { Express, Request, Response } from 'express';
import { createPeerServer, servePeerLib } from './webrtc';
import path from 'path';

const server: Express = express();
createPeerServer(server, '/webrtc');
servePeerLib(server);

server.get('/:path', (req: Request, res: Response) => {
    res.sendFile(path.resolve(path.join('static', req.params.path)));
});

server.listen(3000, () => {
    console.log('Server is running');
})
