import HS from "hyperswarm";
import {
  EventEmitter
} from "node:events";
import crypto from "crypto";
import split2 from 'split2'

class Hyperswarm {
  constructor(hyperswarm) {
    this.emitter = new EventEmitter();

    this.allowedNeighbours = hyperswarm.allowedNeighbours;

    //32 bytes topic (256 bits)
    this.topic = crypto.createHash("sha256").update(hyperswarm.topic).digest();

    this.identityKeyMapping = new Map();
    this.keySocketMapping = new Map();

    this.swarm = new HS();

    this.swarm.join(this.topic, {
      announce: true,
      lookup: true
    });

    this.swarm.on("connection", (socket, info) => {
      let othersIdentity = null;
      const key = socket.remotePublicKey.toString("hex")

      /*
      HELLO PROTOCOL
      once connection is establshed, each peer will send a hello message to the other peer 
      indicating their identitity along with their public key so that mapping can be established
      */

      const helloMessage = {
        label: "HELLO",
        identity: hyperswarm.identity,
        key: this.swarm.keyPair.publicKey.toString("hex")
      }
      socket.write(JSON.stringify(helloMessage) + "\n")
      //removing existing socket connections and registering the new socket connection to this peer with key key
      if (this.keySocketMapping.has(key)) {
        //get the existing socket
        let mappedSocket = this.keySocketMapping.get(key);
        //destroy the existing socket
        mappedSocket.destroy();
        //delete the existing socket
        this.keySocketMapping.delete(key);
      }
      //add the new key socket pair
      this.keySocketMapping.set(key, socket);

      socket.pipe(split2(JSON.parse))
        .on("data", (message) => {

          if (message.label == "HELLO") {
            //if we receive an hello from someone we dont want to connect to, we return;
            if(!this.allowedNeighbours.includes(message.identity.id)){
              console.log("[Hyperswarm] disallowed ",message.identity.id);
              return;
            }

            console.log("[Hyperswarm/socket.on(data)] received HELLO ", message);

            this.identityKeyMapping.set(message.identity.id, message.key);
            othersIdentity = message.identity;

            const helloAckMessage = {
              label: "HELLO-ACK",
              identity: hyperswarm.identity,
              key: this.swarm.keyPair.publicKey.toString("hex")
            }
            socket.write(JSON.stringify(helloAckMessage) + "\n")
            return;
          }

          if (message.label == "HELLO-ACK") {
            console.log("[Hyperswarm/socket.on(data)] received HELLO-ACK ", message);
            this.identityKeyMapping.set(message.identity.id, message.key);
            othersIdentity = message.identity
            //connected only when HELLO acknowledgement is received
            
            this.emitter.emit("connected", message.identity);
            return;
          }

          this.emitter.emit("received", message)
        });

      socket.on("error", (error) => {
        if(error.code == "ETIMEDOUT"){
          this.keySocketMapping.delete(key);

          if(!this.allowedNeighbours.includes(othersIdentity.identity)){
            return;
          }
          this.emitter.emit("disconnected",othersIdentity);
          return;
        }
        this.emitter.emit("error", new Error("[Hyperswarm/socket.on(error)] socket error.",{
          cause:error
        }))
      });

      socket.on("close", () => {
        //delete the key socket mapping
        this.keySocketMapping.delete(key);
        if(!this.allowedNeighbours.includes(othersIdentity.identity)){
            return;
          }
        this.emitter.emit("disconnected",othersIdentity);
      });
    });

    console.log("[Hyperswarm] communication online")
  }

  send(message) {
    if (!message.receiver) {
      this.emitter.emit("error", new Error("[Hyperswarm/send(message)] invalid message format. receiver not specified."))
    }
    let receiver = message.receiver;
    let receiverKey = this.identityKeyMapping.get(receiver);
    if (!receiverKey) {
      this.identityKeyMapping.delete(receiver);
      this.emitter.emit("error", new Error("[Hyperswarm/send(message)] receiver key not found."))
      return
    }
    let receiverSocket = this.keySocketMapping.get(receiverKey);
    if (!receiverSocket) {
      this.keySocketMapping.delete(receiverKey);
      this.emitter.emit("error", new Error("[Hyperswarm/send(message)] receiver socket not found."))
      return;
    }
    //if the socket exists but is in a destroyed state
    if (receiverSocket.destroyed) {
      this.identityKeyMapping.delete(receiver);
      this.keySocketMapping.delete(receiverKey);
      this.emitter.emit("error", new Error("[Hyperswarm/(message)] receiver socket is in destroyed state"))
      if(!this.allowedNeighbours.includes(receiver)){
            return;
          }
      this.emitter.emit("disconnected",{
        id:receiver
      });
      return
    }

    receiverSocket.write(JSON.stringify(message) + "\n");
    this.emitter.emit("sent", message);
  }

  on(eventName, callback) {
    this.emitter.on(eventName, callback);
  }
}

export default Hyperswarm;