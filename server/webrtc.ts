import { ExpressPeerServer } from "peer";
import { Request, Response } from "express";
import path from 'path';

function createPeerServer(server: any, dir: String) {
    const peerServer = ExpressPeerServer(server, {
        path: '/',
    });
    server.use(dir, peerServer);
}
function servePeerLib(server: any) {
    server.get('/lib/peerjs/:file', (req: Request, res: Response) => {
        //serve the peerjs client library (root of project)
        res.sendFile(path.resolve(path.join('node_modules', 'peerjs', 'dist', req.params.file)));
    });
}

export { createPeerServer, servePeerLib };
