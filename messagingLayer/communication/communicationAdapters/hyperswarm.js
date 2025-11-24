import HS from "hyperswarm";
import {
  EventEmitter
} from "node:events";
import crypto from "crypto";
import split2 from 'split2'

class Hyperswarm {
  constructor(hyperswarm) {
    this.emitter = new EventEmitter();
    console.log("[emitter set]")

    //32 bytes topic
    this.topic = crypto.createHash("sha256").update(hyperswarm.topic).digest();
    console.log("[topic set] ", this.topic)

    this.identityKeyMapping = new Map();
    this.keySocketMapping = new Map();

    this.swarm = new HS();
    console.log("[swarm set]")

    this.swarm.join(this.topic, {
      announce: true,
      lookup: true
    });
    console.log("[swarm joined topic]")

    console.log("[swarm.keyPair]",this.swarm.keyPair.publicKey.toString("utf-8"));

    this.swarm.on("connection", (socket,info) => {

      console.log("info object ",info);
      /*
      HELLO PROTOCOL
      once connection is establshed, each peer will send a hello message to the other peer 
      indicating their identitity along with their public key so that mapping can be established
      */

      //sending HELLO message once connection is established
      const helloMessage = {
        label: "HELLO",
        identity: hyperswarm.identity,
        key: this.swarm.keyPair.publicKey.toString("hex")
      }

      console.log("sending hello message");
      socket.write(JSON.stringify(helloMessage) + "\n")
      console.log("hello message sent");

      const key = socket.remotePublicKey.toString("hex")

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
      .on("data",(message)=>{

        if(message.label == "HELLO"){
          this.identityKeyMapping.set(message.identity.id, message.key);
        }

        // if(message.label == "HELLO-ACK"){
        //   this.emitter.emit("connected", message.identity)
        // }

        this.emitter.emit("received", message)
      });

      this.emitter.emit("connected", key)

      socket.on("close", () => {
        console.log("socket closed ",key)
        //delete the key socket mapping
        this.keySocketMapping.delete(key);
      });

      socket.on("error", () => {
        console.log("socket error ",key)
        //destroy the socket
        socket.destroy();
        // delete the key socket mapping
        this.keySocketMapping.delete(key);
      });

    });
  }

  send(message) {
    console.log("send() request received",message)
    let receiver = message.receiver;

    let receiverKey = this.identityKeyMapping.get(receiver);
    if(!receiverKey){
      console.log("no receiver key found")
      return
    }
    let receiverSocket = this.keySocketMapping.get(receiverKey);
    if(!receiverSocket){
      console.log("no receiver socket found")
      return;
    }

    if (receiverSocket.destroyed) {
      console.log("receiver socket is destroyed")
      this.identityKeyMapping.delete(receiver);
      this.keySocketMapping.delete(receiverKey);
      return
    }

    receiverSocket.write(JSON.stringify(message) + "\n");
    console.log("[send()] message sent ")
  }

  on(eventName, cb) {
    this.emitter.on(eventName, cb);
  }
}

export default Hyperswarm;