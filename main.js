const path = require('path');

require('dotenv').config();

require('./menu')

// Reloads app when files in current directory change
require('electron-reload')(path.join(__dirname), {
  electron: require(`${__dirname}/node_modules/electron`)
});

const { dialog, app, BrowserWindow, Menu } = require('electron');
const menuTemplate = require('./menu');
// disables ssl certificate checks
app.commandLine.appendSwitch('ignore-certificate-errors');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      javascript: true,
      webSecurity: false,
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    }
  });
  //url that loads when the app starts replace this with your own url
  win.loadURL(process.env.BASE_URL);
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
