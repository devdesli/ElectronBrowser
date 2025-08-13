const { BrowserWindow, dialog } = require("electron");
require("dotenv").config();
const path = require("path");

const menuTemplate = [
  {
    label: "SSH",
    submenu: [
      {
        label: "SSH Connector",
        click: () => {
          const { BrowserWindow } = require("electron");
          const path = require("path");
          const { fork } = require("child_process");
          const backendPath = path.join(__dirname, "../backend/ssh-proxy.js");
          fork(backendPath);
          const win = new BrowserWindow({
            width: 1000,
            height: 700,
            webPreferences: {
              nodeIntegration: true,
              contextIsolation: false,
            },
          });
          win.loadFile(path.join(__dirname, "../html/ssh-connector.html"));
        },
      },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "Dev",
    submenu: [
      {
        label: "Open Dev Server",
        click: (menuItem, browserWindow) => {
          if (browserWindow) {
            browserWindow.loadURL(process.env.DEV_URL);
          }
        },
      },
      {
        label: "Open Dev Tools",
        click: (menuItem, browserWindow) => {
          if (browserWindow) {
            browserWindow.webContents.openDevTools();
          }
        },
      },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "File",
    submenu: [
      {
        label: "Open File",
        click: async () => {
          try {
            const win = BrowserWindow.getFocusedWindow();
            const { canceled, filePaths } = await dialog.showOpenDialog(win, {
              properties: ["openFile"],
            });

            if (!canceled && filePaths.length > 0) {
              const filePath = filePaths[0];
              win.loadFile(filePath).catch((err) => {
                console.error("Failed to load file:", err);
              });
            }
          } catch (error) {
            console.error("Error opening file:", error);
            dialog.showErrorBox(
              "Error",
              "Failed to open file. Please try again."
            );
          }
        },
      },
    ],
  },
  {
    label: "Navigation",
    submenu: [
      {
        label: "Home",
        click: (menuItem, browserWindow) => {
          if (browserWindow && browserWindow.webContents) {
            browserWindow.webContents.loadURL(process.env.BASE_URL);
          }
        },
      },
      {
        label: "Back",
        click: (menuItem, browserWindow) => {
          if (browserWindow && browserWindow.webContents.canGoBack()) {
            browserWindow.webContents.goBack();
          }
        },
      },
      {
        label: "Forward",
        click: (menuItem, browserWindow) => {
          if (browserWindow && browserWindow.webContents.canGoForward()) {
            browserWindow.webContents.goForward();
          }
        },
      },
      {
        label: "Reload",
        click: (menuItem, browserWindow) => {
          if (browserWindow) {
            browserWindow.webContents.reload();
          }
        },
      },
    ],
  },
  {
    label: "Help",
    submenu: [
      {
        label: "About",
        click: () => {
          dialog.showMessageBox({
            type: "info",
            title: "About",
            message: "Hello from Electron!",
            buttons: ["OK"],
          });
        },
      },
      {
        label: "Reconfigure",
        click: (menuItem, browserWindow) => {
          if (browserWindow) {
            browserWindow.loadFile("setup.html");
          }
        },
      },
    ],
  },
];

module.exports = menuTemplate;
