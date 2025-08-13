// config.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const configDir = path.join(os.homedir(), '.config', 'MyElectronBrowser');
const configPath = path.join(configDir, 'config.json');

function loadConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return null;
}

function saveConfig(data) {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

function setupIfNeeded(mainWindow) {
  let config = loadConfig();
  if (!config) {
    // First run → run setup
    config = {
      os: os.type(),
      platform: os.platform(),
      devServer: '',  // will be filled by user
      baseUrl: ''
    };

    // Here you could open a dialog or a special setup page
    mainWindow.loadFile('setup.html');

    // In your setup.html, collect user inputs and send them back to main process
    // via ipcMain, then save them with saveConfig(config);
  }
  return config;
}

module.exports = { loadConfig, saveConfig, setupIfNeeded };
