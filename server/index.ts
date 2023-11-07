import express, { Express, Request, Response } from 'express';
import { createPeerServer, servePeerLib } from './webrtc';
import path from 'path';

const server: Express = express();
createPeerServer(server, '/webrtc');
servePeerLib(server);

server.get('/:path', (req: Request, res: Response) => {
    res.sendFile(path.resolve(path.join('static', req.params.path)));
});

server.listen(3001, () => {
    console.log('Server is running');
});

//@ts-ignore Process IS defined
process.on('SIGINT', killServer);
//@ts-ignore Process IS defined
process.on('SIGTERM', killServer);
//@ts-ignore Process IS defined
process.on('SIGQUIT', killServer);

function killServer() {
    //@ts-ignore server.close() exists
    server.close();
}


export { killServer };
