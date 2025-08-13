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
let connectionAttempted = false;

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
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus("disconnected");
    }
    return;
  }

  // Clean up any existing connection
  if (ws) {
    ws.close();
    ws = null;
  }

  connectionAttempted = true;
  isConnected = false;

  // Update window title
  document.title = `SSH Terminal - ${params.name}`;

  term.writeln(
    `\r\n\x1b[36m[INFO] Connecting to ${params.username}@${params.host}:${params.port}...\x1b[0m`
  );

  if (window.updateConnectionStatus) {
    window.updateConnectionStatus("connecting");
  }

  // Connect to your SSH proxy WebSocket server
  ws = new WebSocket("ws://localhost:3001");

  ws.onopen = () => {
    console.log("WebSocket connected to SSH proxy");
    term.writeln(
      "\x1b[32m[INFO] WebSocket connected, establishing SSH...\x1b[0m"
    );

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
    }
    if (params.privateKey) {
      connectMessage.privateKey = params.privateKey;
    }

    console.log("Sending connect message:", {
      ...connectMessage,
      password: params.password ? "***" : "",
      privateKey: connectMessage.privateKey ? "***" : "",
    });

    ws.send(JSON.stringify(connectMessage));
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Received message:", message.type, message);

      switch (message.type) {
        case "data":
          // SSH output data - write directly to terminal
          // This is the actual terminal data from the SSH connection
          term.write(message.data);

          // Mark as connected when we receive the first data
          if (!isConnected) {
            isConnected = true;
            if (window.updateConnectionStatus) {
              window.updateConnectionStatus("connected");
            }
            console.log("SSH connection established - receiving data");
          }
          break;

        case "status":
          // Status messages from SSH proxy
          console.log("SSH Status:", message.message);

          if (message.message === "SSH Connected") {
            term.writeln(`\r\n\x1b[32m[${message.message}]\x1b[0m`);
            if (window.updateConnectionStatus) {
              window.updateConnectionStatus("connected");
            }
          } else if (message.message === "Terminal ready") {
            term.writeln(`\x1b[33m[${message.message}]\x1b[0m`);
            term.focus();
            // Don't mark as connected yet - wait for actual data
          } else if (
            message.message.includes("Connection Ended") ||
            message.message.includes("Stream Closed")
          ) {
            term.writeln(`\r\n\x1b[33m[${message.message}]\x1b[0m`);
            isConnected = false;
            if (window.updateConnectionStatus) {
              window.updateConnectionStatus("disconnected");
            }
          } else {
            // Other status messages
            term.writeln(`\r\n\x1b[36m[${message.message}]\x1b[0m`);
          }
          break;

        case "status":
          // Status messages from SSH proxy
          console.log("SSH Status:", message.message);
          term.writeln(`\r\n\x1b[36m[INFO] ${message.message}\x1b[0m`);

          if (message.message === "SSH Connected") {
            // The SSH backend has confirmed the connection, so we can consider it active.
            isConnected = true;
            if (window.updateConnectionStatus) {
              window.updateConnectionStatus("connected");
            }
            term.focus();
          } else if (
            message.message.includes("Connection Ended") ||
            message.message.includes("Stream Closed")
          ) {
            isConnected = false;
            if (window.updateConnectionStatus) {
              window.updateConnectionStatus("disconnected");
            }
          }
          break;

        case "error":
          // Error messages
          term.writeln(`\r\n\x1b[31m[ERROR] ${message.message}\x1b[0m`);
          isConnected = false;
          if (window.updateConnectionStatus) {
            window.updateConnectionStatus("disconnected");
          }
          console.error("SSH Error:", message.message);
          break;

        default:
          console.log("Unknown message type:", message);
          // Try to display unknown messages as info
          if (message.message) {
            term.writeln(`\r\n\x1b[36m[${message.message}]\x1b[0m`);
          }
      }
    } catch (e) {
      console.error("Failed to parse WebSocket message:", e);
      console.log("Raw message:", event.data);
      // For non-JSON messages, try to display them directly
      if (typeof event.data === "string") {
        term.write(event.data);
      }
    }
  };

  ws.onclose = (event) => {
    console.log("WebSocket closed:", event.code, event.reason);
    isConnected = false;
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus("disconnected");
    }

    if (connectionAttempted) {
      if (event.wasClean) {
        term.writeln("\r\n\x1b[33m[INFO] Connection closed cleanly\x1b[0m");
      } else {
        term.writeln("\r\n\x1b[31m[ERROR] Connection lost unexpectedly\x1b[0m");
        term.writeln("\x1b[33m[INFO] Try reconnecting with Ctrl+R\x1b[0m");
      }
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    isConnected = false;
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus("disconnected");
    }
    term.writeln("\r\n\x1b[31m[ERROR] WebSocket connection failed\x1b[0m");
    term.writeln(
      "\x1b[33m[INFO] Make sure the SSH backend is running on port 3001\x1b[0m"
    );
    term.writeln("\x1b[33m[INFO] Try reconnecting with Ctrl+R\x1b[0m");
  };
}

// Handle terminal input
term.onData((data) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    // Send input to SSH proxy - don't wait for isConnected flag
    // The backend will handle queuing if SSH isn't ready yet
    ws.send(
      JSON.stringify({
        type: "input",
        data: data,
      })
    );
  } else {
    console.log("Cannot send input - WebSocket not ready");
  }
});

// Handle window resize
window.addEventListener("resize", () => {
  fitAddon.fit();
});

// Handle window close
window.addEventListener("beforeunload", () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
});

// Auto-connect when page loads
document.addEventListener("DOMContentLoaded", () => {
  // Add a small delay to ensure everything is initialized
  setTimeout(() => {
    connectToSSH();
  }, 100);
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Ctrl+R or Cmd+R to reconnect
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
    e.preventDefault();
    term.writeln("\r\n\x1b[33m[INFO] Reconnecting...\x1b[0m");
    connectionAttempted = false;
    isConnected = false;
    if (ws) {
      ws.close();
    }
    setTimeout(() => {
      connectToSSH();
    }, 100);
  }

  // Ctrl+C to interrupt (send SIGINT)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
    if (ws && ws.readyState === WebSocket.OPEN && isConnected) {
      e.preventDefault();
      ws.send(JSON.stringify({ type: "input", data: "\x03" })); // Send Ctrl+C
    }
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
