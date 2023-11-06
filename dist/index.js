"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const webrtc_1 = require("./webrtc");
const path_1 = __importDefault(require("path"));
const server = (0, express_1.default)();
(0, webrtc_1.createPeerServer)(server, '/webrtc');
(0, webrtc_1.servePeerLib)(server);
server.get('/:path', (req, res) => {
    res.sendFile(path_1.default.resolve(path_1.default.join('static', req.params.path)));
});
server.listen(3000, () => {
    console.log('Server is running');
});
