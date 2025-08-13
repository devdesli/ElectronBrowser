// SSH Proxy Backend (Node.js)
// Usage: node backend/ssh-proxy.js

const { Server } = require("ws");
const { Client } = require("ssh2");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const dbPath = path.join(__dirname, "../hosts.db");

const db = new sqlite3.Database(dbPath);

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

const wss = new Server({ port: 3001 });
console.log("SSH Proxy WebSocket server running on ws://localhost:3001");

wss.on("connection", (ws) => {
  let ssh;
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.action === "connect") {
        // Connect to SSH
        ssh = new Client();
        ssh.on("ready", () => {
          ws.send(JSON.stringify({ type: "status", message: "SSH Connected" }));
          ssh.shell((err, stream) => {
            if (err) {
              ws.send(JSON.stringify({ type: "error", message: err.message }));
              return;
            }
            stream.on("data", (d) =>
              ws.send(JSON.stringify({ type: "data", data: d.toString() }))
            );
            stream.on("close", () =>
              ws.send(
                JSON.stringify({ type: "status", message: "SSH Stream Closed" })
              )
            );
            ws.on("message", (input) => {
              try {
                const inputData = JSON.parse(input);
                if (inputData.type === "input") {
                  stream.write(inputData.data);
                }
              } catch {}
            });
          });
        });
        ssh.on("error", (err) =>
          ws.send(JSON.stringify({ type: "error", message: err.message }))
        );
        const connConfig = {
          host: data.host,
          port: data.port,
          username: data.username,
        };
        if (data.password) connConfig.password = data.password;
        if (data.privateKey) connConfig.privateKey = data.privateKey;
        ssh.connect(connConfig);
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: e.message }));
    }
  });
  ws.on("close", () => {
    if (ssh) ssh.end();
  });
});

// Hosts CRUD API (for Electron renderer)
const express = require("express");
const api = express();
api.use(express.json());

api.get("/hosts", (req, res) => {
  db.all("SELECT * FROM hosts", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

api.post("/hosts", (req, res) => {
  const { name, host, port, username, password, privateKey } = req.body;
  db.run(
    "INSERT INTO hosts (name, host, port, username, password, privateKey) VALUES (?, ?, ?, ?, ?, ?)",
    [name, host, port, username, password, privateKey],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

api.put("/hosts/:id", (req, res) => {
  const { name, host, port, username, password, privateKey } = req.body;
  db.run(
    "UPDATE hosts SET name=?, host=?, port=?, username=?, password=?, privateKey=? WHERE id=?",
    [name, host, port, username, password, privateKey, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

api.delete("/hosts/:id", (req, res) => {
  db.run("DELETE FROM hosts WHERE id=?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

api.listen(3002, () => {
  console.log("Hosts API running on http://localhost:3002");
});
