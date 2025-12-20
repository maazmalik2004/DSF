/**
 * Simple utilities to tell the visualization server about request start/end.
 */

async function reportAccepted(peerId, vizUrl = 'http://localhost:3000') {
  const url = `${vizUrl.replace(/\/$/, '')}/accepted?peer=${encodeURIComponent(peerId)}`;
  await fetch(url, { method: 'POST' }).catch(() => {}); // fire and forget
}

async function reportCompleted(peerId, vizUrl = 'http://localhost:3000') {
  const url = `${vizUrl.replace(/\/$/, '')}/requestCompleted?peer=${encodeURIComponent(peerId)}`;
  await fetch(url, { method: 'POST' }).catch(() => {}); // fire and forget
}

export default { reportAccepted, reportCompleted };