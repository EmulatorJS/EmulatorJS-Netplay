let dev;

function start(io, rooms, numusers, devv) {
    dev = devv;
    consolelog("Socket.io started");
    
}

function consolelog(message){
    if(dev){
        console.log(message);
    }
}
module.exports = { start };