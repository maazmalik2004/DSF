// server.js
// Single-file Node.js server with embedded dashboard + RESET BUTTON
// Run: npm init -y && npm install express && node server.js

import express from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory graph storage
let nodes = new Set();
let links = new Set();

function edgeKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// API: Get current graph
app.get('/graph', (req, res) => {
  const nodesArray = Array.from(nodes).map(name => ({ id: name }));
  const linksArray = Array.from(links).map(key => {
    const [source, target] = key.split('-');
    return { source, target };
  });
  res.json({ nodes: nodesArray, links: linksArray });
});

// API: Add connection
app.post('/addConnection', (req, res) => {
  const { connection } = req.body;
  if (!Array.isArray(connection) || connection.length !== 2) {
    return res.status(400).json({ error: 'connection must be an array of two strings' });
  }
  let [a, b] = connection.map(s => s.trim());
  if (a === b) return res.status(400).json({ error: 'Self-loops not allowed' });

  nodes.add(a);
  nodes.add(b);
  links.add(edgeKey(a, b));

  res.json({ success: true });
});

// API: Remove connection
app.post('/removeConnection', (req, res) => {
  const { connection } = req.body;
  if (!Array.isArray(connection) || connection.length !== 2) {
    return res.status(400).json({ error: 'connection must be an array of two strings' });
  }
  const [a, b] = connection.map(s => s.trim());
  links.delete(edgeKey(a, b));
  res.json({ success: true });
});

// NEW: API to reset the entire graph
app.post('/resetGraph', (req, res) => {
  nodes.clear();
  links.clear();
  res.json({ success: true, message: 'Graph reset' });
});

// Dashboard with Reset Button
app.get('/dashboard', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Network Dashboard</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f8f8f8; }
    svg { width: 100vw; height: 100vh; background: #fff; }
    .link { stroke: #999; stroke-opacity: 0.6; stroke-width: 2px; }
    .node circle { fill: #69b3a2; stroke: #fff; stroke-width: 2px; }
    .node text { font-size: 12px; text-anchor: middle; pointer-events: none; user-select: none; fill: #333; }
    #controls {
      position: absolute;
      top: 20px;
      left: 20px;
      z-index: 100;
      background: rgba(255,255,255,0.9);
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    button {
      padding: 10px 20px;
      font-size: 16px;
      background: #e74c3c;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
    }
    button:hover { background: #c0392b; }
    h1 { margin: 0 0 10px 0; color: #333; }
  </style>
</head>
<body>
  <div id="controls">
    <h1>Interactive Network Graph</h1>
    <button id="resetBtn">Reset Graph</button>
  </div>
  <svg></svg>

  <script>
    const svg = d3.select('svg');
    const width = window.innerWidth;
    const height = window.innerHeight;

    const simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(25));

    let link = svg.append('g').selectAll('.link');
    let node = svg.append('g').selectAll('.node');

    function updateGraph(graph) {
      link = link.data(graph.links, d => \`\${d.source}-\${d.target}\`);
      link.exit().remove();
      link = link.enter().append('line').attr('class', 'link').merge(link);

      node = node.data(graph.nodes, d => d.id);
      node.exit().transition().duration(500).attr('opacity', 0).remove();

      const nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        .call(d3.drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));

      nodeEnter.append('circle').attr('r', 18);
      nodeEnter.append('text').text(d => d.id).attr('y', 35);

      node = nodeEnter.merge(node);

      simulation.nodes(graph.nodes);
      simulation.force('link').links(graph.links);
      simulation.alpha(1).restart();
    }

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => \`translate(\${d.x},\${d.y})\`);
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    }
    function dragged(event, d) {
      d.fx = event.x; d.fy = event.y;
    }
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    }

    function loadGraph() {
      fetch('/graph')
        .then(r => r.json())
        .then(updateGraph)
        .catch(err => console.error('Error loading graph:', err));
    }

    // Reset button functionality
    document.getElementById('resetBtn').addEventListener('click', () => {
      if (confirm('Are you sure you want to reset the entire graph? This will remove all nodes and connections.')) {
        fetch('/resetGraph', { method: 'POST' })
          .then(r => r.json())
          .then(result => {
            if (result.success) {
              loadGraph(); // Refresh with empty graph
            }
          })
          .catch(err => console.error('Reset failed:', err));
      }
    });

    // Initial load and auto-refresh
    loadGraph();
    setInterval(loadGraph, 3000);

    // Handle window resize
    window.addEventListener('resize', () => {
      svg.attr('width', window.innerWidth).attr('height', window.innerHeight);
      simulation.force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2));
      simulation.alpha(0.5).restart();
    });
  </script>
</body>
</html>
  `;

  res.send(html);
});

// Redirect root to dashboard
app.get('/', (req, res) => res.redirect('/dashboard'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Dashboard with Reset button: http://localhost:${PORT}/dashboard`);
});