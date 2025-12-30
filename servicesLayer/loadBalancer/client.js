async function log({ componentId, messageId, eventName, eventValue }) {
    console.log("meowmroww")
    fetch('http://localhost:3000/log', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      componentId,
      messageId,
      eventName,
      eventValue,
    }),
    keepalive: true,
    signal: AbortSignal.timeout(2000),
  })
  .catch(() => {
  });
}

export default { log };
