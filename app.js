const electron = require('electron');
const path = require('path');
const { app, BrowserWindow } = electron;
const cp = require('child_process');
const config = require('./config.json');
let port = config.port;
let password = config.password;
let server;

function createWindow() {
    const win = new BrowserWindow({
      title: "EmulatorJS Netplay Server",
      width: 800,
      height: 600,
      minWidth: 200,
      minHeight: 200,
      transparent: false,
      center: true,
      webPreferences: {
        preload: path.join(__dirname, 'index.js'),
		    nodeIntegration: true,
		    nativeWindowOpen: true
      },
      icon: path.join(__dirname, 'src/img/icon.png')
    });
    win.removeMenu();
    win.setTitle("EmulatorJS Netplay Server");
    win.loadFile(path.join(__dirname, 'src/loading.html'));
}

function startserver(p, a) {
  let opts = Object.create(process.env);
  opts.execArgv = ['--harmony'];
  server = cp.fork(path.join(__dirname, 'server.js'), opts);
  //server.on('message', function(m) {
  //  console.log(m);
  //});
  server.send({ function: 'start', port: p, password: a});
}

function killserver() {
  server.send({ function: 'kill' });
  if (process.platform !== 'darwin') {
    app.quit();
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  startserver(port, password);
});

app.on('window-all-closed', () => {
  killserver();
});

['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => process.on(signal, () => {
  killserver();
  process.exit();
}));