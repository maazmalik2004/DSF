// client.js
// Functions to add/remove peers via your server's API

async function add(peer1, peer2) {
  try {
    const response = await fetch('http://localhost:3000/addConnection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connection: [peer1, peer2] })
    });

    if (!response.ok) {
      throw new Error(`Add failed: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Added ${peer1} ↔ ${peer2}:`, data);
    return data;
  } catch (error) {
    console.error(`Error adding ${peer1} ↔ ${peer2}:`, error.message);
    throw error;
  }
}

async function remove(peer1, peer2) {
  try {
    const response = await fetch('http://localhost:3000/removeConnection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connection: [peer1, peer2] })
    });

    if (!response.ok) {
      throw new Error(`Remove failed: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Removed ${peer1} ↔ ${peer2}:`, data);
    return data;
  } catch (error) {
    console.error(`Error removing ${peer1} ↔ ${peer2}:`, error.message);
    throw error;
  }
}

// Example usage (uncomment to test):
// (async () => {
//   await add('Alice', 'Bob');
//   await remove('Alice', 'Bob');
// })();

export default {
    add,
    remove
}