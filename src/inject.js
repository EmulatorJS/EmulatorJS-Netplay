const { contextBridge, ipcRenderer, shell } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  start: () => ipcRenderer.send('start')
})

document.addEventListener('click', function (event) {
  if (event.target.tagName === 'A' && event.target.href.startsWith('http')) {
    event.preventDefault()
    shell.openExternal(event.target.href)
  }
})