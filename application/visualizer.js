// 

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = 3000;

// In-memory map: peerName -> current active request count
// Map preserves insertion order (first encountered = first in order)
const activeCounts = new Map();

function broadcastUpdate() {
  // No sorting — directly convert Map to object, preserving insertion order
  const data = Object.fromEntries(activeCounts);
  io.emit('update', data);
}

app.use(express.urlencoded({ extended: true }));

// POST /accepted?peer=<name>
// Called when a peer accepts and starts processing a request
app.post('/accepted', (req, res) => {
  const { peer } = req.query;

  if (!peer || typeof peer !== 'string') {
    return res.status(400).send('Missing or invalid peer parameter');
  }

  const current = activeCounts.get(peer) || 0;
  activeCounts.set(peer, current + 1);

  broadcastUpdate();
  res.send(`Request started on ${peer}. Active: ${current + 1}`);
});

// POST /requestCompleted?peer=<name>
// Called when a peer finishes processing a request
app.post('/requestCompleted', (req, res) => {
  const { peer } = req.query;

  if (!peer || typeof peer !== 'string') {
    return res.status(400).send('Missing or invalid peer parameter');
  }

  const current = activeCounts.get(peer) || 0;

  if (current <= 0) {
    return res.status(400).send(`No active requests to complete for ${peer}`);
  }

  activeCounts.set(peer, current - 1);

  // Clean up if count reaches zero
  if (activeCounts.get(peer) === 0) {
    activeCounts.delete(peer);
  }

  broadcastUpdate();
  res.send(`Request completed on ${peer}. Active: ${activeCounts.get(peer) || 0}`);
});

// GET /dashboard
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
    .info { text-align: center; color: #666; margin-bottom: 30px; }
    canvas { max-width: 1000px; margin: 0 auto; display: block; }
  </style>
</head>
<body>
  <h1>Active Requests per Peer (Real-time)</h1>
  <p class="info">Shows how many requests each peer is currently processing<br>
     <strong>Order:</strong> Peers appear from left to right in the order they were first seen</p>
  <canvas id="histogram"></canvas>

  <script>
    const ctx = document.getElementById('histogram').getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Active Requests',
          data: [],
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        animation: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
            title: { display: true, text: 'Currently Processing' }
          },
          x: {
            title: { display: true, text: 'Peer' }
          }
        }
      }
    });

    const socket = io();

    socket.on('update', (data) => {
      const peers = Object.keys(data);
      const counts = Object.values(data);

      chart.data.labels = peers.length ? peers : ['No active requests'];
      chart.data.datasets[0].data = peers.length ? counts : [0];
      chart.update();
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
  console.log(`  POST /accepted?peer=server1   → increment`);
  console.log(`  POST /requestCompleted?peer=server1 → decrement`);
});