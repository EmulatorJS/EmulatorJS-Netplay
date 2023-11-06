"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const webrtc_1 = require("./webrtc");
const server = (0, express_1.default)();
(0, webrtc_1.createPeerServer)(server, '/webrtc');
(0, webrtc_1.servePeerLib)(server);
server.get('/', (req, res) => {
    res.send('Hello World <script src="/lib/peerjs/peerjs.min.js"></script>');
});
server.listen(3000, () => {
    console.log('Server is running');
});
