import Hyperswarm from "./hyperswarm.js";

const identitity = {
  id: "someIdB",
  name: "someNameB"
}

const name = identitity.name;

const swarm = new Hyperswarm({
  topic: "my-test-topic",
  identity: identitity
});

swarm.on("connected", (key) => {
  console.log(`[${name}] Peer connected → ${key}`);
  setInterval(() => {
    const msg = {
      sender:"someIdB",
      receiver:"someIdA",
      meow: "protocol level message",
      from: name,
      ts: Date.now()
    };
    swarm.send(msg);
    console.log(`[${name}]sent periodic protocol level message`);
  }, 10000);

  swarm.send({
    sender:"someIdB",
    receiver:"someIdA",
    label: "protocol level message",
    from: name,
    says:"hello!!!"
  });
});

swarm.on("received", (message) => {
  console.log(`[${name}]received protocol level message`, message);
});