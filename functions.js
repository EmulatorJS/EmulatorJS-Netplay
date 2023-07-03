let dev;

function start(io, devv, numusers) {
    dev = devv;
    consolelog("Socket.io started");
    
}

function consolelog(message){
    if(dev){
        console.log(message);
    }
}
module.exports = { start };