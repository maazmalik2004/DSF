// server.js (ESM) — FINAL WITH POLLING (3-second updates)
import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;
const db = new sqlite3.Database('logs.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      component_id TEXT,
      message_id TEXT,
      event_name TEXT,
      event_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_component ON logs (component_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_message ON logs (message_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_event ON logs (event_name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_created ON logs (created_at)');
});

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function getComponentMap(cb) {
  db.all('SELECT DISTINCT component_id FROM logs', (err, rows) => {
    if (err) return cb({});
    const map = {};
    rows.forEach(({ component_id }) => {
      const name = component_id.split('-')[0];
      map[name] ||= [];
      map[name].push(component_id);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.localeCompare(b)));
    cb(map);
  });
}

app.post('/log', (req, res) => {
  const { componentId, messageId, eventName, eventValue } = req.body;
  if (!componentId || !messageId || !eventName || eventValue === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (componentId.split('-').length < 2) {
    return res.status(400).json({ error: 'Invalid componentId format' });
  }

  const eventValueStr = typeof eventValue === 'object' ? JSON.stringify(eventValue) : String(eventValue);

  db.get('SELECT 1 FROM logs WHERE component_id = ? LIMIT 1', [componentId], (err, row) => {
    const isNew = !row;
    db.run(
      'INSERT INTO logs (component_id, message_id, event_name, event_value) VALUES (?, ?, ?, ?)',
      [componentId, messageId, eventName, eventValueStr],
      (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });

        // Only notify clients when a completely new component appears
        if (isNew) {
          getComponentMap(map => io.emit('update_components', map));
        }
        // No per-log 'new_log' emit anymore — frontend polls instead
      }
    );
  });
});

app.get('/components', (req, res) => getComponentMap(map => res.json(map)));

// Data tab: pivoted with serial + timestamps
app.get('/logs/:componentId', (req, res) => {
  const { componentId } = req.params;
  db.all('SELECT message_id, event_name, event_value, created_at FROM logs WHERE component_id = ? ORDER BY created_at', [componentId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (rows.length === 0) return res.status(404).json({ error: 'Component not found' });

    const dict = {};
    const events = new Set();
    const times = {};

    rows.forEach(r => {
      dict[r.message_id] ||= {};
      dict[r.message_id][r.event_name] = r.event_value;
      events.add(r.event_name);

      times[r.message_id] ||= { first: r.created_at, last: r.created_at };
      if (r.created_at < times[r.message_id].first) times[r.message_id].first = r.created_at;
      if (r.created_at > times[r.message_id].last) times[r.message_id].last = r.created_at;
    });

    const eventNames = Array.from(events).sort();
    const tableData = Object.entries(dict)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([messageId, events], index) => ({
        serial: index + 1,
        messageId,
        first_event_time: times[messageId].first,
        last_event_time: times[messageId].last,
        events
      }));

    res.json({ eventNames, tableData });
  });
});

app.get('/flat-logs/:componentId', (req, res) => {
  const { componentId } = req.params;
  db.all('SELECT message_id, event_name, event_value FROM logs WHERE component_id = ?', [componentId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    const data = rows.map(r => ({ messageId: r.message_id, eventName: r.event_name, value: r.event_value }));
    res.json(data);
  });
});

// Pivoted logs for visualization — includes timestamps
app.get('/pivoted-logs/:componentId', (req, res) => {
  const { componentId } = req.params;

  db.all(
    'SELECT DISTINCT event_name FROM logs WHERE component_id = ? ORDER BY event_name',
    [componentId],
    (err, eventRows) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      const eventNames = eventRows.map(r => r.event_name);

      if (eventNames.length === 0) {
        return res.json([]);
      }

      let query = `
        SELECT 
          ROW_NUMBER() OVER (ORDER BY MIN(created_at)) AS serial,
          message_id,
          MIN(created_at) AS first_event_time,
          MAX(created_at) AS last_event_time`;
      eventNames.forEach(name => {
        const safe = name.replace(/'/g, "''");
        const colName = name.replace(/"/g, '""');
        query += `,\n          MAX(CASE WHEN event_name = '${safe}' THEN event_value END) AS "${colName}"`;
      });
      query += `
        FROM logs 
        WHERE component_id = ?
        GROUP BY message_id
        ORDER BY MIN(created_at)`;

      db.all(query, [componentId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
      });
    }
  );
});

// SQL tab: full support with serial + timestamps
app.post('/sql-query/:componentId', (req, res) => {
  const { componentId } = req.params;
  const { sql } = req.body;

  const trimmed = sql?.trim();
  if (!trimmed) return res.status(400).json({ error: 'Query is empty' });

  const lower = trimmed.toLowerCase();
  if (!lower.startsWith('select') && !lower.startsWith('with')) {
    return res.status(400).json({ error: 'Only SELECT queries allowed' });
  }

  const dangerous = ['insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate'];
  if (dangerous.some(kw => lower.includes(kw + ' '))) {
    return res.status(400).json({ error: 'Only SELECT queries allowed' });
  }

  db.all(
    'SELECT DISTINCT event_name FROM logs WHERE component_id = ? ORDER BY event_name',
    [componentId],
    (err, eventRows) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      const eventNames = eventRows.map(r => r.event_name);

      let pivotCTE = `
        WITH pivoted_logs AS (
          SELECT 
            ROW_NUMBER() OVER (ORDER BY MIN(created_at)) AS serial,
            message_id,
            MIN(created_at) AS first_event_time,
            MAX(created_at) AS last_event_time`;
      eventNames.forEach(name => {
        const safe = name.replace(/'/g, "''");
        const colName = name.replace(/"/g, '""');
        pivotCTE += `,\n            MAX(CASE WHEN event_name = '${safe}' THEN event_value END) AS "${colName}"`;
      });
      pivotCTE += `
          FROM logs
          WHERE component_id = ?
          GROUP BY message_id
        )`;

      const userQuery = trimmed.replace(/\blogs\b/gi, 'pivoted_logs');
      const finalQuery = lower.startsWith('with')
        ? pivotCTE + ',\n' + userQuery.substring(4)
        : pivotCTE + '\n' + userQuery;

      db.all(finalQuery, [componentId], (err, rows) => {
        if (err) return res.status(500).json({ error: `Query error: ${err.message}` });
        if (rows.length === 0) {
          const columns = ['serial', 'message_id', 'first_event_time', 'last_event_time', ...eventNames];
          return res.json({ columns, rows: [] });
        }
        const columns = Object.keys(rows[0]);
        res.json({ columns, rows });
      });
    }
  );
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/dashboard`);
});

const io = new Server(server);
io.on('connection', socket => {
  socket.on('subscribe', id => socket.join(id));
  socket.on('unsubscribe', id => socket.leave(id));
});