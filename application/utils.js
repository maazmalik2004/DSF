// /**
//  * Simple utilities to tell the visualization server about request start/end.
//  */

// async function reportAccepted(peerId, vizUrl = 'http://localhost:3000') {
//   const url = `${vizUrl.replace(/\/$/, '')}/accepted?peer=${encodeURIComponent(peerId)}`;
//   await fetch(url, { method: 'POST' }).catch(() => {}); // fire and forget
// }

// async function reportCompleted(peerId, vizUrl = 'http://localhost:3000') {
//   const url = `${vizUrl.replace(/\/$/, '')}/requestCompleted?peer=${encodeURIComponent(peerId)}`;
//   await fetch(url, { method: 'POST' }).catch(() => {}); // fire and forget
// }

// export default { reportAccepted, reportCompleted };

/**
 * Simple utilities to interact with the visualization dashboard server.
 * 
 * - reportAccepted / reportCompleted: Track active request counts per peer
 * - log: Track individual request/response events by ID for success rate and logging
 */

const DEFAULT_VIZ_URL = 'http://localhost:3000';

async function reportAccepted(peerId, vizUrl = DEFAULT_VIZ_URL) {
  const url = `${vizUrl.replace(/\/$/, '')}/accepted?peer=${encodeURIComponent(peerId)}`;
  await fetch(url, { method: 'POST' }).catch(() => {}); // fire and forget
}

async function reportCompleted(peerId, vizUrl = DEFAULT_VIZ_URL) {
  const url = `${vizUrl.replace(/\/$/, '')}/requestCompleted?peer=${encodeURIComponent(peerId)}`;
  await fetch(url, { method: 'POST' }).catch(() => {}); // fire and forget
}

/**
 * Log a request or response event for a specific ID.
 * This updates the real-time event table and success rate on the dashboard.
 *
 * @param {string} id - Unique request identifier
 * @param {'request' | 'response'} event - The event type
 * @param {string} [vizUrl] - Base URL of the visualization server (default: http://localhost:3000)
 */
async function log(id, event, vizUrl = DEFAULT_VIZ_URL) {
  if (!id || typeof id !== 'string') {
    console.warn('log(): Invalid or missing id');
    return;
  }

  if (!['request', 'response',"dropped"].includes(event)) {
    console.warn(`log(): Invalid event "${event}". Must be "request" or "response"`);
    return;
  }

  const url = `${vizUrl.replace(/\/$/, '')}/log`;
  
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, event }),
  }).catch(() => {}); // fire and forget
}

export default {
  reportAccepted,
  reportCompleted,
  log,
};