import dgram from 'node:dgram';

const socket = dgram.createSocket('udp4');

const message = Buffer.from('Hello, LAN devices! This is a broadcast message.');
const broadcastAddress = '255.255.255.255'; // Or e.g., '192.168.1.255' for your subnet
const port = 41234;

async function sendBroadcast() {
  await new Promise((resolve) => socket.bind(resolve)); // Bind to any available port

  socket.setBroadcast(true);

  socket.send(message, port, broadcastAddress, (err) => {
    if (err) {
      console.error('Error sending broadcast:', err);
    } else {
      console.log(`Broadcast message sent to ${broadcastAddress}:${port}`);
    }
    socket.close();
  });
}

sendBroadcast().catch(console.error);