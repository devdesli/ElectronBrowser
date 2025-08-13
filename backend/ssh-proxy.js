// SSH Proxy Backend (Node.js)
// Usage: node backend/ssh-proxy.js

const { Server } = require("ws");
const { Client } = require("ssh2");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const express = require("express");
const net = require("net");
const { exec } = require("child_process");

const dbPath = path.join(__dirname, "../hosts.db");
const db = new sqlite3.Database(dbPath);

// Function to kill processes using a specific port
function killProcessOnPort(port) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      // Windows command to find and kill process on port
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (error || !stdout) {
          console.log(`No process found on port ${port}`);
          resolve();
          return;
        }
        
        const lines = stdout.split('\n');
        const pids = new Set();
        
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5 && parts[1].includes(`:${port}`)) {
            const pid = parts[4];
            if (pid && pid !== '0') {
              pids.add(pid);
            }
          }
        });
        
        if (pids.size > 0) {
          const pidArray = Array.from(pids);
          console.log(`Killing processes on port ${port}: ${pidArray.join(', ')}`);
          
          let killCount = 0;
          pidArray.forEach(pid => {
            exec(`taskkill /F /PID ${pid}`, (killError) => {
              killCount++;
              if (killError) {
                console.log(`Failed to kill process ${pid}:`, killError.message);
              }
              if (killCount === pidArray.length) {
                setTimeout(resolve, 1000);
              }
            });
          });
        } else {
          resolve();
        }
      });
    } else {
      // Unix/Linux/Mac command
      exec(`lsof -ti:${port}`, (error, stdout) => {
        if (error || !stdout) {
          console.log(`No process found on port ${port}`);
          resolve();
          return;
        }
        
        const pids = stdout.trim().split('\n').filter(pid => pid);
        if (pids.length > 0) {
          console.log(`Killing processes on port ${port}: ${pids.join(', ')}`);
          exec(`kill -9 ${pids.join(' ')}`, (killError) => {
            if (killError) {
              console.log(`Failed to kill processes:`, killError.message);
            }
            setTimeout(resolve, 1000);
          });
        } else {
          resolve();
        }
      });
    }
  });
}

// Function to check if port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.close(() => {
        resolve(true);
      });
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

// Initialize servers after clearing ports
async function initializeServers() {
  const WS_PORT = 3001;
  const API_PORT = 3002;
  
  console.log('Checking and clearing ports...');
  
  // Kill any existing processes on our ports
  await killProcessOnPort(WS_PORT);
  await killProcessOnPort(API_PORT);
  
  // Wait longer for processes to fully terminate
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check if ports are available
  const wsPortAvailable = await isPortAvailable(WS_PORT);
  const apiPortAvailable = await isPortAvailable(API_PORT);
  
  if (!wsPortAvailable) {
    console.error(`Port ${WS_PORT} is still in use. Trying to start anyway...`);
    // Don't exit, try to start anyway
  }
  
  if (!apiPortAvailable) {
    console.error(`Port ${API_PORT} is still in use. Trying to start anyway...`);
    // Don't exit, try to start anyway
  }
  
  console.log('Starting servers...');
  startServers();
}

function startServers() {

// Create hosts table if not exists
db.run(`CREATE TABLE IF NOT EXISTS hosts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  host TEXT,
  port INTEGER,
  username TEXT,
  password TEXT,
  privateKey TEXT
)`);

// WebSocket server for SSH connections
let wss;
try {
  wss = new Server({ port: 3001 });
  console.log("SSH Proxy WebSocket server running on ws://localhost:3001");
} catch (error) {
  console.error("Failed to start WebSocket server:", error.message);
  process.exit(1);
}

wss.on("connection", (ws) => {
  console.log("New WebSocket connection");
  let ssh = null;
  let stream = null;
  
  const cleanup = () => {
    if (stream) {
      stream.removeAllListeners();
      stream.end();
      stream = null;
    }
    if (ssh) {
      ssh.removeAllListeners();
      ssh.end();
      ssh = null;
    }
  };

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      console.log('Received WebSocket message:', data.action || data.type);
      
      if (data.action === "connect") {
        console.log(`Attempting SSH connection to ${data.username}@${data.host}:${data.port}`);
        
        // Validate required parameters
        if (!data.host || !data.username) {
          const error = 'Missing required connection parameters (host or username)';
          console.error(error);
          ws.send(JSON.stringify({ type: "error", message: error }));
          return;
        }
        
        // Clean up any existing connection
        cleanup();
        
        ssh = new Client();
        
        ssh.on("ready", () => {
          console.log("SSH connection established successfully");
          ws.send(JSON.stringify({ type: "status", message: "SSH Connected" }));
          
          // Request a shell
          ssh.shell({
            cols: 80,
            rows: 24,
            term: 'xterm-256color'
          }, (err, shellStream) => {
            if (err) {
              console.error("Shell error:", err);
              ws.send(JSON.stringify({ type: "error", message: `Shell error: ${err.message}` }));
              return;
            }
            
            stream = shellStream;
            console.log("Shell stream created successfully");
            
            // Handle data from SSH server
            stream.on("data", (d) => {
              const data = d.toString();
              // Don't log every data packet as it can be overwhelming
              ws.send(JSON.stringify({ type: "data", data: data }));
            });
            
            // Handle stream close
            stream.on("close", () => {
              console.log("SSH stream closed");
              ws.send(JSON.stringify({ type: "status", message: "SSH Stream Closed" }));
              cleanup();
            });
            
            // Handle stream errors
            stream.on("error", (err) => {
              console.error("Stream error:", err);
              ws.send(JSON.stringify({ type: "error", message: `Stream error: ${err.message}` }));
            });
            
            // Send ready status
            setTimeout(() => {
              console.log("Terminal ready for input");
              ws.send(JSON.stringify({ type: "status", message: "Terminal ready" }));
            }, 500);
          });
        });
        
        ssh.on("error", (err) => {
          console.error("SSH connection error:", err.message);
          ws.send(JSON.stringify({ type: "error", message: `SSH Error: ${err.message}` }));
          cleanup();
        });
        
        ssh.on("end", () => {
          console.log("SSH connection ended");
          ws.send(JSON.stringify({ type: "status", message: "SSH Connection Ended" }));
        });
        
        ssh.on("close", () => {
          console.log("SSH connection closed");
          cleanup();
        });

        // Build connection configuration
        const connConfig = {
          host: data.host,
          port: data.port || 22,
          username: data.username,
          readyTimeout: 20000,
          keepaliveInterval: 30000
        };

        // Add authentication
        let authMethod = 'none';
        if (data.password) {
          connConfig.password = data.password;
          authMethod = 'password';
        }
        
        if (data.privateKey) {
          connConfig.privateKey = data.privateKey;
          authMethod = data.password ? 'password+key' : 'key';
        }
        
        console.log(`Connecting with ${authMethod} authentication to ${data.username}@${data.host}:${data.port}`);

        try {
          ssh.connect(connConfig);
        } catch (error) {
          console.error("Connection error:", error);
          ws.send(JSON.stringify({ type: "error", message: `Connection failed: ${error.message}` }));
        }
      }
      
      // Handle terminal input
      else if (data.type === "input" && stream) {
        // Log input only for debugging, comment out in production
        // console.log('Terminal input:', JSON.stringify(data.data));
        stream.write(data.data);
      }
      
    } catch (e) {
      console.error("Message parsing error:", e);
      ws.send(JSON.stringify({ type: "error", message: `Protocol error: ${e.message}` }));
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
    cleanup();
  });
  
  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    cleanup();
  });
});

// REST API for hosts management
const api = express();
api.use(express.json());
api.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

api.get("/hosts", (req, res) => {
  db.all("SELECT * FROM hosts", (err, rows) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

api.post("/hosts", (req, res) => {
  const { name, host, port, username, password, privateKey } = req.body;
  
  if (!host || !username) {
    return res.status(400).json({ error: "Host and username are required" });
  }
  
  db.run(
    "INSERT INTO hosts (name, host, port, username, password, privateKey) VALUES (?, ?, ?, ?, ?, ?)",
    [name || `${username}@${host}`, host, port || 22, username, password || '', privateKey || ''],
    function (err) {
      if (err) {
        console.error("Database insert error:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, message: "Host added successfully" });
    }
  );
});

api.put("/hosts/:id", (req, res) => {
  const { name, host, port, username, password, privateKey } = req.body;
  
  if (!host || !username) {
    return res.status(400).json({ error: "Host and username are required" });
  }
  
  db.run(
    "UPDATE hosts SET name=?, host=?, port=?, username=?, password=?, privateKey=? WHERE id=?",
    [name, host, port || 22, username, password || '', privateKey || '', req.params.id],
    function (err) {
      if (err) {
        console.error("Database update error:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ updated: this.changes, message: "Host updated successfully" });
    }
  );
});

api.delete("/hosts/:id", (req, res) => {
  db.run("DELETE FROM hosts WHERE id=?", [req.params.id], function (err) {
    if (err) {
      console.error("Database delete error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ deleted: this.changes, message: "Host deleted successfully" });
  });
});

// Health check endpoint
api.get("/health", (req, res) => {
  res.json({ status: "ok", message: "SSH Proxy API is running" });
});

const API_PORT = 3002;
try {
  api.listen(API_PORT, () => {
    console.log(`Hosts API running on http://localhost:${API_PORT}`);
  });
} catch (error) {
  console.error("Failed to start API server:", error.message);
  process.exit(1);
}

} // End of startServers function

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  
  // Close WebSocket server
  if (typeof wss !== 'undefined') {
    wss.close(() => {
      console.log('WebSocket server closed');
    });
  }
  
  // Close database
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

// Start the application
console.log('Starting SSH Proxy Server...');
initializeServers().catch(error => {
  console.error('Failed to initialize servers:', error);
  process.exit(1);
});

// Prevent multiple instances
process.on('exit', () => {
  console.log('SSH Proxy Server shutting down...');
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});