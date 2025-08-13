const { Terminal } = require("xterm");
const { FitAddon } = require("xterm-addon-fit");

// Initialize xterm.js terminal
const term = new Terminal({
  cursorBlink: true,
  fontSize: 14,
  theme: {
    background: "#181818",
    foreground: "#ffffff",
  },
});

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);

const terminalElement = document.getElementById("terminal");
term.open(terminalElement);
fitAddon.fit();

// Make terminal available globally for SSH hosts API
window.term = term;

let ws = null;
let isConnected = false;

// Parse connection parameters from URL
function getConnectionParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    host: urlParams.get("host"),
    port: parseInt(urlParams.get("port")) || 22,
    username: urlParams.get("username"),
    password: urlParams.get("password") || "",
    privateKey: urlParams.get("privateKey") || "",
    name: urlParams.get("name") || "SSH Terminal",
  };
}

// Connect to SSH via WebSocket proxy
function connectToSSH() {
  const params = getConnectionParams();

  console.log("Terminal connection params:", params);

  if (!params.host || !params.username) {
    const error = "Missing host or username parameters";
    console.error(error);
    term.writeln("\r\n\x1b[31m[ERROR] " + error + "\x1b[0m");
    term.writeln(
      "\x1b[33m[DEBUG] URL params:",
      window.location.search,
      "\x1b[0m"
    );
    return;
  }

  // Update window title
  document.title = `SSH Terminal - ${params.name}`;

  term.writeln(
    `\r\n\x1b[36m[INFO] Connecting to ${params.username}@${params.host}:${params.port}...\x1b[0m`
  );
  term.writeln(
    `\x1b[33m[DEBUG] WebSocket connecting to ws://localhost:3001\x1b[0m`
  );

  // Connect to your SSH proxy WebSocket server
  ws = new WebSocket("ws://localhost:3001");

  ws.onopen = () => {
    console.log("WebSocket connected");
    term.writeln(
      "\x1b[32m[INFO] WebSocket connected, establishing SSH connection...\x1b[0m"
    );
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus("connecting");
    }

    // Send connection request to SSH proxy
    const connectMessage = {
      action: "connect",
      host: params.host,
      port: params.port,
      username: params.username,
    };

    // Add authentication
    if (params.password) {
      connectMessage.password = params.password;
      term.writeln("\x1b[33m[DEBUG] Using password authentication\x1b[0m");
    }
    if (params.privateKey) {
      connectMessage.privateKey = params.privateKey;
      term.writeln("\x1b[33m[DEBUG] Using private key authentication\x1b[0m");
    }

    console.log("Sending connect message:", {
      ...connectMessage,
      password: "***",
      privateKey: connectMessage.privateKey ? "***" : "",
    });
    ws.send(JSON.stringify(connectMessage));
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "data":
          // SSH output data - write directly to terminal
          term.write(message.data);
          if (!isConnected) {
            isConnected = true;
            term.writeln(
              "\r\n\x1b[32m[INFO] SSH connection established!\x1b[0m"
            );
          }
          break;

        case "status":
          // Status messages from SSH proxy
          term.writeln(`\r\n\x1b[33m[${message.message}]\x1b[0m`);
          if (message.message === "SSH Connected") {
            isConnected = true;
            // Update status in header if function exists
            if (window.updateConnectionStatus) {
              window.updateConnectionStatus("connected");
            }
          } else if (message.message === "Terminal ready") {
            // Terminal is ready for input
            term.focus();
          }
          break;

        case "error":
          // Error messages
          term.writeln(`\r\n\x1b[31m[ERROR] ${message.message}\x1b[0m`);
          break;

        default:
          console.log("Unknown message type:", message);
      }
    } catch (e) {
      console.error("Failed to parse WebSocket message:", e);
      term.write(event.data); // Fallback: write raw data
    }
  };

  ws.onclose = (event) => {
    isConnected = false;
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus("disconnected");
    }
    if (event.wasClean) {
      term.writeln("\r\n\x1b[33m[INFO] Connection closed\x1b[0m");
    } else {
      term.writeln("\r\n\x1b[31m[ERROR] Connection lost\x1b[0m");
    }
  };

  ws.onerror = (error) => {
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus("disconnected");
    }
    term.writeln("\r\n\x1b[31m[ERROR] WebSocket connection failed\x1b[0m");
    term.writeln("\x1b[33m[INFO] Make sure the SSH backend is running\x1b[0m");
    console.error("WebSocket error:", error);
  };
}

// Handle terminal input
term.onData((data) => {
  if (ws && ws.readyState === WebSocket.OPEN && isConnected) {
    // Send input to SSH proxy
    ws.send(
      JSON.stringify({
        type: "input",
        data: data,
      })
    );
  }
});

// Handle window resize
window.addEventListener("resize", () => {
  fitAddon.fit();
});

// Handle window close
window.addEventListener("beforeunload", () => {
  if (ws) {
    ws.close();
  }
});

// Auto-connect when page loads
document.addEventListener("DOMContentLoaded", () => {
  connectToSSH();
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Ctrl+R or Cmd+R to reconnect
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
    e.preventDefault();
    if (ws) {
      ws.close();
    }
    setTimeout(() => {
      connectToSSH();
    }, 100);
  }

  // F12 to open DevTools (if in Electron)
  if (e.key === "F12") {
    e.preventDefault();
    if (window.require) {
      try {
        const { remote } = window.require("electron");
        remote.getCurrentWindow().webContents.openDevTools();
      } catch (err) {
        console.log("DevTools not available");
      }
    }
  }
});

// Focus terminal on click
terminalElement.addEventListener("click", () => {
  term.focus();
});

// Initial focus
term.focus();
