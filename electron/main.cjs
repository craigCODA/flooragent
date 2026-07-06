const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const appVersion = require('../package.json').version;

const isDev = !app.isPackaged;

function getIconPath() {
  // In dev: build/icon.png relative to project root
  // In prod: build/icon.png is in extraResources or alongside app
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

function loadRenderer(win, query = {}) {
  if (isDev) {
    const url = new URL('http://localhost:5173');
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }
    win.loadURL(url.toString());
    return;
  }
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0b1120',
    show: false,
    title: 'FloorAgent',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // External links open in default browser; blank popups are allowed (e.g. printable move list)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  loadRenderer(win);

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
}

function createMapWindow() {
  const mapWin = new BrowserWindow({
    width: 1700,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#0b1120',
    show: false,
    title: 'FloorAgent - Map',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mapWin.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  loadRenderer(mapWin, { view: 'map' });

  if (isDev) {
    mapWin.webContents.openDevTools({ mode: 'detach' });
  }

  mapWin.once('ready-to-show', () => {
    mapWin.maximize();
    mapWin.show();
  });
}

app.whenReady().then(() => {
  ipcMain.handle('wo:open-map-window', () => {
    createMapWindow();
    return true;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
