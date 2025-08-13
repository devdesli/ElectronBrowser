
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const menuTemplate = require('./menu');

require('./menu');

// disables ssl certificate checks
app.commandLine.appendSwitch('ignore-certificate-errors');

const envPath = path.join(app.getPath('userData'), '.env');

function loadEnvConfig() {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    return {
      DEV_URL: process.env.DEV_URL,
      BASE_URL: process.env.BASE_URL,
      OS: process.env.OS
    };
  }
  return null;
}

ipcMain.on('save-config', (event, data) => {
  const envContent = `DEV_URL=${data.devUrl}\nBASE_URL=${data.baseUrl}\nOS=${data.os}\n`;
  fs.writeFileSync(envPath, envContent);
  require('dotenv').config({ path: envPath }); // reload env
  event.sender.send('config-saved');
});

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

ipcMain.on('save-config', (event, config) => {
    const envContent = `
OS=${config.os}
PLATFORM=${config.platform}
DEV_SERVER=${config.devServer}
BASE_URL=${config.baseUrl}
    `.trim();

    fs.writeFileSync(path.join(__dirname, '.env'), envContent, 'utf8');

    console.log('.env file updated!');
});

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      javascript: true,
      webSecurity: false,
      nodeIntegration: true, // allow require in setup.html
      contextIsolation: false,
      webviewTag: true,
    }
  });

  const config = loadEnvConfig();

  if (!config || !config.BASE_URL || !isValidUrl(config.BASE_URL)) {
    win.loadFile('setup.html');
    ipcMain.once('config-saved', () => {
      const newConfig = loadEnvConfig();
      if (newConfig && newConfig.BASE_URL && isValidUrl(newConfig.BASE_URL)) {
        win.loadURL(newConfig.BASE_URL);
      }
    });
  } else {
    win.loadURL(config.BASE_URL);
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
