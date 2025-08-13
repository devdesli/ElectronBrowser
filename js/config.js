// config.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const { app } = require("electron");

const envPath = app
  ? path.join(app.getPath("userData"), ".env")
  : path.join(os.homedir(), ".config", "MyElectronBrowser", ".env");

function loadConfig() {
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, "utf8");
    const lines = env.split("\n");
    const config = {};
    lines.forEach((line) => {
      const [key, value] = line.split("=");
      if (key && value !== undefined) config[key.trim()] = value.trim();
    });
    return config;
  }
  return null;
}

function saveConfig(data) {
  const envContent = `DEV_URL=${data.DEV_URL || ""}\nBASE_URL=${
    data.BASE_URL || ""
  }\nOS=${data.OS || ""}\n`;
  fs.writeFileSync(envPath, envContent);
}

function setupIfNeeded(mainWindow) {
  let config = loadConfig();
  if (!config || !config.BASE_URL) {
    win.loadFile(path.join(__dirname, "html/setup.html")); // corrected relative path
  }
  return config;
}

module.exports = { loadConfig, saveConfig, setupIfNeeded };
