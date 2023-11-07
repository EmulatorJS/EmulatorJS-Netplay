"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const index_1 = require("../server/index");
function createWindow() {
    const win = new electron_1.BrowserWindow({
        title: 'EmulatorJS Netplay Server',
        width: 800,
        height: 600,
        minWidth: 200,
        minHeight: 200,
        transparent: false,
        center: true,
    });
    win.removeMenu();
    win.loadURL('http://localhost:3001/index.html');
}
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => {
    (0, index_1.killServer)();
    //@ts-ignore the process is defined
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
