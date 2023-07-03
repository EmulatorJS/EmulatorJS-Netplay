let dev;

function start(io, rooms, numusers, devv) {
    dev = devv;
    consolelog("Socket.io started");
    io.on('connection', (socket) => {
        updateusers();
        let url = socket.handshake.url;
        let args = transformArgs(url);
        let extraData = JSON.parse(args.extra);
        let room = null;

    });

    function updateusers(){
        numusers.num = io.engine.clientsCount;
    }
}

function transformArgs(url) {
    var args = {}
    var idx = url.indexOf('?')
    if (idx != -1) {
        var s = url.slice(idx + 1)
        var parts = s.split('&')
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i]
            var idx2 = p.indexOf('=')
            args[decodeURIComponent(p.slice(0, idx2))] = decodeURIComponent(p.slice(idx2 + 1, s.length))
        }
    }
    return args
}

function consolelog(message){
    if(dev){
        console.log(message);
    }
}
module.exports = { start, transformArgs };