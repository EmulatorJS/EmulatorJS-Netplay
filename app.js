const electron = require('electron');
const path = require('path');
const { app, BrowserWindow } = electron;

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
    win.loadFile(path.join(__dirname, 'src', 'index.html'));
    win.setTitle("EmulatorJS Netplay Server");
  }
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})