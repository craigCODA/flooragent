const { contextBridge, ipcRenderer } = require('electron');

// Version is passed from main process via additionalArguments (safe in sandbox mode)
const appVersion =
  process.argv.find(a => a.startsWith('--app-version='))?.split('=')[1] ?? '2.B';

contextBridge.exposeInMainWorld('wo', {
  version: appVersion,
  openMapWindow: () => ipcRenderer.invoke('wo:open-map-window'),
});
