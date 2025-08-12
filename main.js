const path = require('path');

// Reloads app when files in current directory change
require('electron-reload')(path.join(__dirname), {
  electron: require(`${__dirname}/node_modules/electron`)
});


const { app, BrowserWindow } = require('electron');
// disables ssl certificate checks
app.commandLine.appendSwitch('ignore-certificate-errors', 'true');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });
  //url that loads when the app starts replace this with your own url
  win.loadURL('http://100.75.133.26:8090/');
}

// creates the browser window
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// quits the app when everything is closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
