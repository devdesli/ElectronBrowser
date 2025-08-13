const { Terminal } = require("xterm");
const { FitAddon } = require("xterm-addon-fit");

let term = new Terminal({ cursorBlink: true, fontSize: 14 });
let fitAddon = new FitAddon();
term.loadAddon(fitAddon);

const termElem = document.getElementById("terminal");
term.open(termElem);
fitAddon.fit();

const autoRunCheckbox = document.getElementById("autoRun");
let ws;

document.getElementById("connectBtn").addEventListener("click", () => {
  // Fallback: connect to remote shell via WebSocket
  const host = window.REMOTE_HOST || "localhost";
  const port = window.REMOTE_PORT || "3000";
  const token = window.AUTH_TOKEN || "";
  const autoRun = autoRunCheckbox.checked;

  term.writeln(`\r\n[INFO] Connecting to ws://${host}:${port} ...`);
  ws = new WebSocket(`ws://${host}:${port}?token=${token}`);

  ws.onmessage = (event) => term.write(event.data);
  term.onData((data) => ws.send(data));

  ws.onopen = () => {
    if (autoRun) {
      ws.send("ls\n");
    }
  };
});

window.addEventListener("resize", () => fitAddon.fit());
