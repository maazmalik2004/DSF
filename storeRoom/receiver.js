import dgram from 'node:dgram';

const socket = dgram.createSocket('udp4');
const port = 41234;

socket.on('message', (msg, rinfo) => {
  console.log(`Received message: "${msg}" from ${rinfo.address}:${rinfo.port}`);
});

socket.on('listening', () => {
  const address = socket.address();
  console.log(`Listening for broadcasts on port ${address.port}`);
});

socket.on('error', (err) => {
  console.error(`Socket error: ${err}`);
  socket.close();
});

socket.bind(port);