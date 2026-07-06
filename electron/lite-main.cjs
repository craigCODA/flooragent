const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;

function getIconPath() {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(process.resourcesPath || '', 'icon.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 780,
    minWidth: 720,
    minHeight: 600,
    backgroundColor: '#070d18',
    show: false,
    title: 'FloorAgent Lite',
    icon: getIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Allow blank popups for the View output window
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  if (isDev) {
    win.loadURL('http://localhost:5174');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist-lite', 'lite.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
