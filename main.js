const path = require('path');
const fs = require('fs');
const os = require('os');
console.log(os.platform());   // 'win32', 'linux', 'darwin'
console.log(os.release());    // e.g. '6.1.7601'
console.log(os.type());       // 'Windows_NT', 'Linux', etc.

require('dotenv').config();

require('./menu')

// Reloads app when files in current directory change
require('electron-reload')(path.join(__dirname), {
  electron: require(`${__dirname}/node_modules/electron`)
});

const { dialog, app, BrowserWindow, Menu, ipcMain } = require('electron');
const { setupIfNeeded } = require('./config');
const menuTemplate = require('./menu');
// disables ssl certificate checks
app.commandLine.appendSwitch('ignore-certificate-errors');

const configPath = path.join(app.getPath('userData'), 'config.json');

ipcMain.on('save-config', (event, data) => {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
  console.log('Config saved to', configPath);
  event.sender.send('config-saved');
});

function createWindow() {
  const win = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        javascript: true,
        webSecurity: false,
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true,
      }
    });
  
    const config = setupIfNeeded(win);
  
    if (config) {
      console.log('Config loaded:', config);
      if (config.baseUrl) {
        win.loadURL(config.baseUrl);
      } else {
        win.loadFile('setup.html');
      }
    }
  }
  
//sets the application menu changable
const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

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
