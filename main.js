const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const menuTemplate = require("./js/menu");

const { app, BrowserWindow, Menu, ipcMain } = require("electron");

// disables ssl certificate checks
app.commandLine.appendSwitch("ignore-certificate-errors");
app.commandLine.appendSwitch("disable-gpu-vsync");
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-software-rasterizer");

// ...backend now starts only when SSH Connector is opened...

const envPath = path.join(app.getPath("userData"), ".env");

function loadEnvConfig() {
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: path.join(__dirname, "../.env") }); // updated to use __dirname
    return {
      DEV_URL: process.env.DEV_URL,
      BASE_URL: process.env.BASE_URL,
      OS: process.env.OS,
    };
  }
  return null;
}

ipcMain.on("save-config", (event, data) => {
  const envContent = `DEV_URL=${data.devUrl}\nBASE_URL=${data.baseUrl}\nOS=${data.os}\n`;
  fs.writeFileSync(envPath, envContent);
  require("dotenv").config({ path: envPath }); // reload env
  event.sender.send("config-saved");
});

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

ipcMain.on("save-config", (event, config) => {
  const envContent = `
OS=${config.os}
PLATFORM=${config.platform}
DEV_SERVER=${config.devServer}
BASE_URL=${config.baseUrl}
    `.trim();

  fs.writeFileSync(path.join(__dirname, ".env"), envContent, "utf8");

  console.log(".env file updated!");
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
    },
  });

  const config = loadEnvConfig();

  if (!config || !config.BASE_URL || !isValidUrl(config.BASE_URL)) {
    win.loadFile(path.join(__dirname, "html/setup.html")); // corrected relative path
    ipcMain.once("config-saved", () => {
      const newConfig = loadEnvConfig();
      if (newConfig && newConfig.BASE_URL && isValidUrl(newConfig.BASE_URL)) {
        win.loadURL(newConfig.BASE_URL);
      }
    });
  } else {
    win.loadURL(config.BASE_URL); // no change needed here
  }
}

//sets the application menu changable
const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

// creates the browser window
app.whenReady().then(() => {
  createWindow();

  // Global shortcuts for all browser windows
  const { globalShortcut } = require('electron');
  app.on('browser-window-focus', (event, win) => {
    globalShortcut.register('CommandOrControl+R', () => {
      if (win) win.reload();
    });
    globalShortcut.register('F12', () => {
      if (win) win.webContents.openDevTools();
    });
  });
  app.on('browser-window-blur', () => {
    globalShortcut.unregister('CommandOrControl+R');
    globalShortcut.unregister('F12');
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// quits the app when everything is closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
