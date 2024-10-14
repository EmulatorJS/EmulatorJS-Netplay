const electron = require('electron');
const path = require('path');
const { app, BrowserWindow, ipcMain } = electron;
const cp = require('child_process');
const config = require('./config.json');
let port = config.port;
let password = config.password;
let dev = config.dev;
let server;
let win;

function createWindow() {
    win = new BrowserWindow({
      title: "EmulatorJS Netplay Server",
      width: 800,
      height: 600,
      minWidth: 200,
      minHeight: 200,
      transparent: false,
      center: true,
      webPreferences: {
        preload: path.join(__dirname, 'src/inject.js'),
		    nodeIntegration: true,
		    nativeWindowOpen: true
      },
      icon: path.join(__dirname, 'src/img/icon.png')
    });
    win.removeMenu();
    win.setTitle("EmulatorJS Netplay Server");
    win.loadFile(path.join(__dirname, 'src/loading.html'));
}

function startserver() {
  server = cp.fork(path.join(__dirname, 'server.js'));
  server.send({ function: 'start', port: port, password: password, app: true, dev: dev});
  server.on('message', function(m) {
    if(m.function == 'url'){
      win.loadURL(m.url);
    }
  });
  server.on('exit', function(code) {
    process.exit();
  });
}

function killserver() {
  server.send({ function: 'kill' });
}

ipcMain.on('start', (event, title) => {
  startserver();
})

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('login', (event, webContents, request, authInfo, callback) => {
  event.preventDefault();
  callback("admin", password);
});

app.on('window-all-closed', () => {
  killserver();
});