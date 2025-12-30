// public/script.js — FINAL VERSION: NO JUMPING, SMOOTH SCROLL PRESERVATION

document.addEventListener('DOMContentLoaded', () => {
  const componentList = document.getElementById('component-list');
  const tableContainer = document.getElementById('table-container');
  const sqlResult = document.getElementById('sql-result');
  const vizResult = document.getElementById('viz-result');
  let selectedId = null;
  let tableData = [];
  let eventNames = [];
  let needsRender = false;
  let currentView = null;
  const socket = io();

  // CodeMirror editors
  const sqlEditor = CodeMirror.fromTextArea(document.getElementById('sql-editor'), {
    mode: 'sql',
    lineNumbers: true,
    theme: 'default',
    extraKeys: { 'Ctrl-Space': 'autocomplete' }
  });

  const vizEditor = CodeMirror.fromTextArea(document.getElementById('viz-editor'), {
    mode: 'javascript',
    lineNumbers: true,
    theme: 'default',
    extraKeys: { 'Ctrl-Space': 'autocomplete' }
  });

  // Render component list
  function renderComponentList(components) {
    componentList.innerHTML = '';
    const sortedNames = Object.keys(components).sort();
    sortedNames.forEach(name => {
      const nameDiv = document.createElement('div');
      nameDiv.className = 'component-name';
      nameDiv.textContent = name;
      componentList.appendChild(nameDiv);

      components[name].forEach(id => {
        const idDiv = document.createElement('div');
        idDiv.className = 'component-id';
        idDiv.textContent = id;
        if (id === selectedId) idDiv.classList.add('selected');
        idDiv.addEventListener('click', () => {
          document.querySelectorAll('.component-id').forEach(el => el.classList.remove('selected'));
          idDiv.classList.add('selected');
          if (selectedId) socket.emit('unsubscribe', selectedId);
          selectedId = id;
          socket.emit('subscribe', id);
          loadLogs(id);
          sqlResult.innerHTML = '<div class="empty-message">Run a query to see results.</div>';
          vizResult.innerHTML = '';
          currentView = null;
        });
        componentList.appendChild(idDiv);
      });
    });
  }

  // Load components
  async function loadComponents() {
    const response = await fetch('/components');
    const components = await response.json();
    renderComponentList(components);
  }

  // Load pivoted logs for Data tab
  async function loadLogs(componentId) {
    const response = await fetch(`/logs/${componentId}`);
    if (!response.ok) {
      tableContainer.innerHTML = '<div class="empty-message">Error loading logs</div>';
      return;
    }
    const { eventNames: sortedEventNames, tableData: data } = await response.json();
    eventNames = sortedEventNames;
    tableData = data;
    renderTablePreserveScroll();
    needsRender = false;
  }

  // FINAL FIX: Preserve scroll position perfectly
  function renderTablePreserveScroll() {
    if (tableData.length === 0) {
      tableContainer.innerHTML = '<div class="empty-message">No data available.</div>';
      return;
    }

    // Get current scrollable wrapper and its scroll position
    const currentWrapper = tableContainer.querySelector('.table-wrapper');
    const scrollTop = currentWrapper ? currentWrapper.scrollTop : 0;

    // Build new table HTML
    let html = '<div class="table-wrapper"><table><thead><tr><th>#</th><th>Message ID</th><th>First Event Time</th><th>Last Event Time</th>';
    eventNames.forEach(name => {
      html += `<th>${name}</th>`;
    });
    html += '</tr></thead><tbody>';

    tableData.forEach(row => {
      html += `<tr>
        <td>${row.serial}</td>
        <td>${row.messageId}</td>
        <td>${row.first_event_time || ''}</td>
        <td>${row.last_event_time || ''}</td>`;
      eventNames.forEach(name => {
        html += `<td>${row.events[name] || ''}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';

    // Replace content
    tableContainer.innerHTML = html;

    // Restore scroll position on the new wrapper
    const newWrapper = tableContainer.querySelector('.table-wrapper');
    if (newWrapper) {
      newWrapper.scrollTop = scrollTop;
    }
  }

  // Run SQL query — also with table-wrapper
  document.getElementById('run-sql').addEventListener('click', async () => {
    if (!selectedId) return alert('Select a component first');

    const sql = sqlEditor.getValue();
    const response = await fetch(`/sql-query/${selectedId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });

    const data = await response.json();
    if (data.error) {
      sqlResult.innerHTML = `<div class="text-danger">${data.error}</div>`;
      return;
    }

    if (data.rows.length === 0) {
      sqlResult.innerHTML = '<div class="empty-message">No results found.</div>';
      return;
    }

    let html = '<div class="table-wrapper"><table><thead><tr>';
    data.columns.forEach(col => {
      html += `<th>${col}</th>`;
    });
    html += '</tr></thead><tbody>';

    data.rows.forEach(row => {
      html += '<tr>';
      data.columns.forEach(col => {
        const value = row[col] ?? '';
        html += `<td>${value}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    sqlResult.innerHTML = html;
  });

  // Generate Visualization
  document.getElementById('run-viz').addEventListener('click', async () => {
    if (!selectedId) return alert('Select a component first');

    let spec;
    try {
      spec = JSON.parse(vizEditor.getValue());
    } catch (e) {
      vizResult.innerHTML = `<div class="text-danger">Invalid JSON: ${e.message}</div>`;
      return;
    }

    spec = JSON.parse(JSON.stringify(spec));
    if (spec.data && spec.data.url && typeof spec.data.url === 'string') {
      spec.data.url = spec.data.url.replace('{componentId}', selectedId);
    }

    vegaEmbed('#viz-result', spec, { renderer: 'svg', actions: true })
      .then(result => {
        currentView = result.view;
      })
      .catch(err => {
        vizResult.innerHTML = `<div class="text-danger">Visualization error: ${err.message}</div>`;
      });
  });

  // Socket.IO real-time updates — now preserves scroll
  socket.on('update_components', renderComponentList);

  socket.on('new_log', () => {
    if (selectedId) {
      loadLogs(selectedId); // This now preserves scroll perfectly
    }
    if (currentView) {
      document.getElementById('run-viz').click();
    }
  });

  // Re-render Data tab on switch if needed
  const tabElement = document.getElementById('myTab');
  tabElement.addEventListener('shown.bs.tab', (event) => {
    const target = event.target.getAttribute('data-bs-target');
    if (target === '#data' && needsRender) {
      renderTablePreserveScroll();
      needsRender = false;
    }
  });

  // Initial load
  loadComponents();
});