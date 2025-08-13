const { BrowserWindow, dialog } = require('electron');
require('dotenv').config();

const menuTemplate = [
  {
    label: 'Dev',
    submenu: [
      {
        label: 'Open Dev Server',
        click: (menuItem, browserWindow) => {
          if (browserWindow) {
            browserWindow.loadURL(process.env.DEV_URL);
          }
        }
      },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  {
    label: 'File',
    submenu: [
      {
        label: 'Open File',
        click: async () => {
          try {
            const win = BrowserWindow.getFocusedWindow();
            const { canceled, filePaths } = await dialog.showOpenDialog(win, {
              properties: ['openFile']
            });

            if (!canceled && filePaths.length > 0) {
              const filePath = filePaths[0];
              win.loadFile(filePath).catch(err => {
                console.error('Failed to load file:', err);
              });
            }
          } catch (error) {
            console.error('Error opening file:', error);
            dialog.showErrorBox('Error', 'Failed to open file. Please try again.');
          }
        }
      }
    ]
  },
  {
    label: 'Navigation',
    submenu: [
        {
            label: 'Home',
            click: (menuItem, browserWindow) => {
              if (browserWindow && browserWindow.webContents) {
                browserWindow.webContents.loadURL(process.env.BASE_URL);
              }
            }
      },
      {
        label: 'Back',
        click: (menuItem, browserWindow) => {
          if (browserWindow && browserWindow.webContents.canGoBack()) {
            browserWindow.webContents.goBack();
          }
        }
      },
      {
        label: 'Forward',
        click: (menuItem, browserWindow) => {
          if (browserWindow && browserWindow.webContents.canGoForward()) {
            browserWindow.webContents.goForward();
          }
        }
      },
      {
        label: 'Reload',
        click: (menuItem, browserWindow) => {
          if (browserWindow) {
            browserWindow.webContents.reload();
          }
        }
      }
    ]
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'About',
        click: () => {
          dialog.showMessageBox({
            type: 'info',
            title: 'About',
            message: 'Hello from Electron!',
            buttons: ['OK']
          });
        }
      },
      {
        label: 'Reconfigure',
        click: (menuItem, browserWindow) => {
          if (browserWindow) {
            browserWindow.loadFile('setup.html');
          }
        }
      }
    ]
  }
];

module.exports = menuTemplate;
