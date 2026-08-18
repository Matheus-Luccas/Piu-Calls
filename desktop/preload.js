// Preload roda antes da página carregar, com acesso limitado ao Node.js.
// Expomos aqui só uma pontezinha segura pro app conseguir checar/instalar
// atualizações — o resto da página é uma web app comum que fala com o
// servidor via HTTP/WebSocket, sem precisar de mais nada do Electron.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('squadUpdater', {
  check: () => ipcRenderer.invoke('updater:check'),
  install: () => ipcRenderer.invoke('updater:install'),
  onStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  },
});
