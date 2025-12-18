import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

/* ---------------- PATH ---------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- APP ---------------- */

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

/* ---------------- STATE ---------------- */

const graph = {
  nodes: new Set(),
  edges: [] // { source, target }
};

const logs = new Map(); // messageId → aggregated log

/* ---------------- HELPERS ---------------- */

function buildAdjacency() {
  const adj = {};
  graph.nodes.forEach(n => (adj[n] = []));
  graph.edges.forEach(e => {
    adj[e.source].push(e.target);
    adj[e.target].push(e.source);
  });
  return adj;
}

function pathExists(source, target) {
  if (!source || !target) return false;
  if (!graph.nodes.has(source) || !graph.nodes.has(target)) return false;

  const adj = buildAdjacency();
  const visited = new Set();
  const queue = [source];

  while (queue.length) {
    const node = queue.shift();
    if (node === target) return true;
    visited.add(node);
    for (const next of adj[node]) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return false;
}

/* ---------------- API ---------------- */

app.post("/addConnection", (req, res) => {
  const { firstPeer, secondPeer } = req.body;
  if (!firstPeer || !secondPeer) return res.sendStatus(400);

  graph.nodes.add(firstPeer);
  graph.nodes.add(secondPeer);
  graph.edges.push({ source: firstPeer, target: secondPeer });

  io.emit("graphUpdate", {
    nodes: [...graph.nodes],
    edges: graph.edges
  });

  res.sendStatus(200);
});

app.post("/removeConnection", (req, res) => {
  const { firstPeer, secondPeer } = req.body;

  graph.edges = graph.edges.filter(
    e =>
      !(e.source === firstPeer && e.target === secondPeer) &&
      !(e.source === secondPeer && e.target === firstPeer)
  );

  io.emit("graphUpdate", {
    nodes: [...graph.nodes],
    edges: graph.edges
  });

  res.sendStatus(200);
});

app.post("/logEvent", (req, res) => {
  const { messageId, eventType, source, target, reason } = req.body;
  if (!messageId || !eventType) return res.sendStatus(400);

  const log =
    logs.get(messageId) ??
    {
      messageId,
      dispatched: false,
      received: false,
      ack: false,
      nack: false,
      pathExists: false,
      source,
      target,
      reason: null
    };

  if (eventType === 1) {
    log.dispatched = true;
    log.pathExists = pathExists(source, target);
  }
  if (eventType === 2) log.received = true;
  if (eventType === 3) log.ack = true;
  if (eventType === 4) {
    log.nack = true;
    log.reason = reason;
  }

  logs.set(messageId, log);

  // Only emit if path existed at DISPATCH time
  if (log.dispatched && log.pathExists) {
    io.emit("logUpdate", log);
  }

  res.sendStatus(200);
});

/* ---------------- DASHBOARD ---------------- */

app.get("/dashboard", (_, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

/* ---------------- SOCKET ---------------- */

io.on("connection", socket => {
  console.log("✅ Socket connected:", socket.id);
});

/* ---------------- START ---------------- */

server.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000/dashboard");
});
