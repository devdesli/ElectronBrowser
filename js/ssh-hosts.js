// SSH Hosts UI logic for Electron renderer
// This should be loaded in your SSH connector window

const apiBase = "http://localhost:3002";
const wsBase = "ws://localhost:3001";

async function fetchHosts() {
  const res = await fetch(apiBase + "/hosts");
  return await res.json();
}

async function addHost(host) {
  const res = await fetch(apiBase + "/hosts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(host),
  });
  return await res.json();
}

async function updateHost(id, host) {
  const res = await fetch(apiBase + "/hosts/" + id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(host),
  });
  return await res.json();
}

async function deleteHost(id) {
  const res = await fetch(apiBase + "/hosts/" + id, { method: "DELETE" });
  return await res.json();
}

function connectSSH(host, password, privateKey) {
  const ws = new WebSocket(wsBase);
  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        action: "connect",
        host: host.host,
        port: host.port,
        username: host.username,
        password,
        privateKey,
      })
    );
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "data") {
      // Write to xterm.js
      window.term.write(msg.data);
    } else if (msg.type === "status") {
      window.term.writeln("\r\n[" + msg.message + "]");
    } else if (msg.type === "error") {
      window.term.writeln("\r\n[ERROR] " + msg.message);
    }
  };
  window.term.onData((data) =>
    ws.send(JSON.stringify({ type: "input", data }))
  );
  return ws;
}

window.sshHostsApi = {
  fetchHosts,
  addHost,
  updateHost,
  deleteHost,
  connectSSH,
};
