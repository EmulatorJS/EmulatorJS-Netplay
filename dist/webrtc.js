"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.servePeerLib = exports.createPeerServer = void 0;
const peer_1 = require("peer");
const path_1 = __importDefault(require("path"));
function createPeerServer(server, dir) {
    const peerServer = (0, peer_1.ExpressPeerServer)(server, {
        path: '/',
    });
    server.use(dir, peerServer);
}
exports.createPeerServer = createPeerServer;
function servePeerLib(server) {
    server.get('/lib/peerjs/:file', (req, res) => {
        //serve the peerjs client library (root of project)
        res.sendFile(path_1.default.resolve(path_1.default.join('node_modules', 'peerjs', 'dist', req.params.file)));
    });
}
exports.servePeerLib = servePeerLib;
