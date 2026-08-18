const { app, BrowserWindow, session, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;

function sendUpdaterStatus(status, extra = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', { status, ...extra });
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e1f22',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// Atualização automática: o app confere sozinho, ao abrir, se existe uma
// versão mais nova publicada na Release do GitHub (a mesma que alimenta a
// página /download), baixa em segundo plano, e avisa a pessoa quando estiver
// pronta pra reiniciar e aplicar — sem precisar desinstalar/instalar de novo
// a cada atualização. Também dá pra checar manualmente pelo botão no app.
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => sendUpdaterStatus('checking'));
  autoUpdater.on('update-available', (info) => sendUpdaterStatus('available', { version: info.version }));
  autoUpdater.on('update-not-available', () => sendUpdaterStatus('not-available'));
  autoUpdater.on('download-progress', (progress) =>
    sendUpdaterStatus('downloading', { percent: Math.round(progress.percent) })
  );
  autoUpdater.on('update-downloaded', (info) => sendUpdaterStatus('downloaded', { version: info.version }));
  autoUpdater.on('error', (err) => sendUpdaterStatus('error', { message: err?.message || String(err) }));

  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      sendUpdaterStatus('error', { message: err?.message || String(err) });
    }
  });

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall();
  });

  // Confere sozinho pouco depois de abrir (sem travar a inicialização) e não
  // trava nem mostra erro pra ninguém se a pessoa estiver sem internet nesse
  // instante ou se ainda não existir nenhuma Release publicada.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 3000);
}

app.whenReady().then(() => {
  // Libera automaticamente pedidos de câmera/microfone/compartilhamento de tela
  // feitos pela página (o sistema operacional ainda pede a permissão de
  // câmera/microfone do app na primeira vez, isso é normal).
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem', 'display-capture'];
    callback(allowed.includes(permission));
  });

  // Compartilhamento de tela: nesta versão inicial compartilha a tela inteira
  // (o primeiro monitor encontrado), sem seletor de janela específica.
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then((sources) => {
        callback(sources.length > 0 ? { video: sources[0] } : {});
      })
      .catch(() => callback({}));
  });

  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
