// visualizer.js

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = 3000;

// In-memory map: peerName -> current active request count
const activeCounts = new Map();

// Event logs
const eventLogs = [];
const idToIndex = new Map(); // id -> index in eventLogs

let nextSerial = 1;

function broadcastUpdate() {
  const activeData = Object.fromEntries(activeCounts);
  const logData = eventLogs.map(entry => ({ ...entry }));

  // Success Rate: Only up to the last completed response
  let totalRequests = eventLogs.length;
  let successfulResponses = eventLogs.filter(entry => entry.response).length;
  let successRate = '0.00000';
  let note = '';

  if (eventLogs.length > 0) {
    let lastResponseIndex = -1;
    for (let i = eventLogs.length - 1; i >= 0; i--) {
      if (eventLogs[i].response) {
        lastResponseIndex = i;
        break;
      }
    }

    if (lastResponseIndex !== -1) {
      const consideredLogs = eventLogs.slice(0, lastResponseIndex + 1);
      totalRequests = consideredLogs.length;
      successfulResponses = consideredLogs.filter(entry => entry.response).length;
      successRate = ((successfulResponses / totalRequests) * 100).toFixed(5);
      if (lastResponseIndex + 1 < eventLogs.length) {
        note = ' (up to last completed)';
      }
    }
  }

  io.emit('update', {
    active: activeData,
    logs: logData,
    success: {
      total: totalRequests,
      successful: successfulResponses,
      rate: successRate,
      note: note
    }
  });
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/accepted', (req, res) => {
  const { peer } = req.query;
  if (!peer || typeof peer !== 'string') return res.status(400).send('Missing or invalid peer parameter');

  const current = activeCounts.get(peer) || 0;
  activeCounts.set(peer, current + 1);

  broadcastUpdate();
  res.send(`Request started on ${peer}. Active: ${current + 1}`);
});

app.post('/requestCompleted', (req, res) => {
  const { peer } = req.query;
  if (!peer || typeof peer !== 'string') return res.status(400).send('Missing or invalid peer parameter');

  const current = activeCounts.get(peer) || 0;
  if (current <= 0) return res.status(400).send(`No active requests to complete for ${peer}`);

  activeCounts.set(peer, current - 1);
  if (activeCounts.get(peer) === 0) activeCounts.delete(peer);

  broadcastUpdate();
  res.send(`Request completed on ${peer}. Active: ${activeCounts.get(peer) || 0}`);
});

app.post('/log', (req, res) => {
  const { id, event } = req.body;

  if (!id || typeof id !== 'string') return res.status(400).send('Missing or invalid id');
  if (!['request', 'response', 'dropped'].includes(event)) {
    return res.status(400).send('Invalid event: must be "request", "response", or "dropped"');
  }

  if (event === 'request') {
    if (idToIndex.has(id)) return res.status(400).send(`Request already logged for id ${id}`);
    const entry = { serial: nextSerial++, id, request: true, response: false, dropped: false };
    const index = eventLogs.push(entry) - 1;
    idToIndex.set(id, index);
  } else if (event === 'response') {
    const index = idToIndex.get(id);
    if (index === undefined) return res.status(400).send(`No request logged for id ${id}`);
    if (eventLogs[index].dropped) return res.status(400).send(`Request ${id} was already marked as dropped`);
    eventLogs[index].response = true;
  } else if (event === 'dropped') {
    const index = idToIndex.get(id);
    if (index === undefined) return res.status(400).send(`No request logged for id ${id}`);
    if (eventLogs[index].response || eventLogs[index].dropped) {
      return res.status(400).send(`Request ${id} already has response or was dropped`);
    }
    eventLogs[index].dropped = true;
  }

  broadcastUpdate();
  res.send(`Logged ${event} for id ${id}`);
});

app.delete('/log/:id', (req, res) => {
  const { id } = req.params;
  const index = idToIndex.get(id);

  if (index === undefined) {
    return res.status(404).send(`Log entry with id ${id} not found`);
  }

  eventLogs.splice(index, 1);
  idToIndex.delete(id);
  for (let i = index; i < eventLogs.length; i++) {
    const entryId = eventLogs[i].id;
    idToIndex.set(entryId, i);
  }

  broadcastUpdate();
  res.send(`Deleted log entry for id ${id}`);
});

app.delete('/logs', (req, res) => {
  eventLogs.length = 0;
  idToIndex.clear();
  nextSerial = 1;

  broadcastUpdate();
  res.send('All logs cleared');
});

app.get('/dashboard', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Distributed System Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f9fbfc; color: #333; }
    h1 { text-align: center; }
    .container { display: flex; justify-content: space-around; align-items: flex-start; gap: 30px; }
    .left { flex: 1; max-width: 550px; }
    .right { flex: 2; max-width: 800px; position: relative; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
    th { background-color: #f2f2f2; }
    canvas { max-width: 100%; display: block; }
    .success-rate {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      text-align: center;
      min-width: 200px;
      z-index: 1000;
    }
    .success-rate h3 { margin: 0 0 10px 0; color: #333; font-size: 1.1em; }
    .success-rate .rate { font-size: 2em; font-weight: bold; color: #4CAF50; font-family: monospace; }
    .success-rate .details { font-size: 0.9em; color: #666; }
    .delete-btn { 
      background: #ff4444; color: white; border: none; border-radius: 4px; 
      padding: 4px 8px; cursor: pointer; font-size: 0.8em; 
    }
    .delete-btn:hover { background: #cc0000; }
    .clear-all { 
      margin: 10px 0; padding: 8px 12px; background: #ff6666; color: white; 
      border: none; border-radius: 4px; cursor: pointer; 
    }
    .clear-all:hover { background: #ff3333; }
    .dropped { color: #d32f2f; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Distributed System Dashboard</h1>

  <div class="success-rate" id="successRate">
    <h3>Success Rate</h3>
    <div class="rate" id="rate">0.00000%</div>
    <div class="details" id="details">0 / 0</div>
  </div>

  <div class="container">
    <div class="left">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2>Event Logs (Real-time)</h2>
        <button class="clear-all" id="clearAll">Clear All Logs</button>
      </div>
      <p class="info">Logs requests, responses, and dropped requests by ID<br>Order: By first appearance</p>
      <table id="logTable">
        <thead>
          <tr>
            <th>Serial</th>
            <th>ID</th>
            <th>Request</th>
            <th>Response</th>
            <th>Dropped</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>

    <div class="right">
      <h2>Active Requests per Peer</h2>
      <p class="info">Shows how many requests each peer is currently processing<br>
         <strong>Order:</strong> Peers appear from left to right in the order they were first seen</p>
      <canvas id="histogram"></canvas>
    </div>
  </div>

  <script>
    const ctx = document.getElementById('histogram').getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Active Requests', data: [], backgroundColor: 'rgba(255, 99, 132, 0.7)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1 }] },
      options: {
        responsive: true,
        animation: false,
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: 'Currently Processing' } },
          x: { title: { display: true, text: 'Peer' } }
        }
      }
    });

    const logTableBody = document.querySelector('#logTable tbody');
    const rateEl = document.getElementById('rate');
    const detailsEl = document.getElementById('details');
    const clearAllBtn = document.getElementById('clearAll');

    const socket = io();

    function renderLogs(logs) {
      logTableBody.innerHTML = '';
      if (logs.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6">No logs yet</td>';
        logTableBody.appendChild(row);
        return;
      }

      logs.forEach((log) => {
        const row = document.createElement('tr');
        row.innerHTML = \`
          <td>\${log.serial}</td>
          <td>\${log.id}</td>
          <td>\${log.request ? '✔️' : ''}</td>
          <td>\${log.response ? '✔️' : ''}</td>
          <td>\${log.dropped ? '<span class="dropped">✘ Dropped</span>' : ''}</td>
          <td><button class="delete-btn" data-id="\${log.id}">Delete</button></td>
        \`;
        logTableBody.appendChild(row);
      });

      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          if (!confirm(\`Delete log entry for ID \${id}?\`)) return;
          await fetch(\`/log/\${encodeURIComponent(id)}\`, { method: 'DELETE' });
        });
      });
    }

    clearAllBtn.addEventListener('click', async () => {
      if (!confirm('Clear ALL logs? This cannot be undone.')) return;
      await fetch('/logs', { method: 'DELETE' });
    });

    socket.on('update', ({ active, logs, success }) => {
      rateEl.textContent = \`\${success.rate}%\`;
      detailsEl.textContent = \`\${success.successful} / \${success.total}\${success.note || ''}\`;

      const peers = Object.keys(active);
      const counts = Object.values(active);
      chart.data.labels = peers.length ? peers : ['No active requests'];
      chart.data.datasets[0].data = peers.length ? counts : [0];
      chart.update();

      renderLogs(logs);
    });
  </script>
</body>
</html>
  `;

  res.type('html').send(html);
});

server.listen(PORT, () => {
  console.log(`Visualization server running on http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`Endpoints:`);
  console.log(`  POST /accepted?peer=server1`);
  console.log(`  POST /requestCompleted?peer=server1`);
  console.log(`  POST /log  {"id": "abc", "event": "request"}`);
  console.log(`  POST /log  {"id": "abc", "event": "response"}`);
  console.log(`  POST /log  {"id": "abc", "event": "dropped"}   ← NEW`);
  console.log(`  DELETE /log/:id   → delete single log entry`);
  console.log(`  DELETE /logs      → clear all logs`);
});