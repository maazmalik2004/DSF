const BASE_URL = "http://localhost:3000";

/* ---------------- CONNECTION MANAGEMENT ---------------- */

/**
 * Register a connection between two peers
 */
export async function registerConnect(a, b) {
  if (!a || !b) throw new Error("Both peers are required");

  await fetch(`${BASE_URL}/addConnection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstPeer: a,
      secondPeer: b
    })
  });
}

/**
 * Delete a connection between two peers
 */
export async function deleteConnect(a, b) {
  if (!a || !b) throw new Error("Both peers are required");

  await fetch(`${BASE_URL}/removeConnection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstPeer: a,
      secondPeer: b
    })
  });
}

/* ---------------- EVENT LOGGING ---------------- */

/**
 * Log an event
 *
 * eventNo:
 * 1 = dispatched
 * 2 = received
 * 3 = received ack
 * 4 = received nack
 */
export async function logEvent(
  id,
  eventNo,
  source = undefined,
  target = undefined,
  reason = undefined
) {
  if (!id || !eventNo) {
    throw new Error("id and eventNo are required");
  }

  const payload = {
    messageId: id,
    eventType: eventNo
  };

  if (source !== undefined) payload.source = source;
  if (target !== undefined) payload.target = target;
  if (reason !== undefined) payload.reason = reason;

  await fetch(`${BASE_URL}/logEvent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export default {
    registerConnect,
    deleteConnect,
    logEvent
}