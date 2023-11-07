import { app, BrowserWindow, ipcMain } from 'electron';
import { killServer } from '../server/index';

function createWindow() {
    const win = new BrowserWindow({
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    killServer();
    //@ts-ignore the process is defined
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
