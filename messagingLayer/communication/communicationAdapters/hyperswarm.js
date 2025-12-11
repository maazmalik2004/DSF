import HS from "hyperswarm";
import {
    EventEmitter
} from "node:events";
import crypto from "crypto";
import split2 from 'split2';

class Hyperswarm {
    constructor(object) {
        this.emitter = new EventEmitter();

        this.timeout = object.timeout || 3000;

        //32 bytes topic (256 bits)
        this.topic = crypto.createHash("sha256").update(object.topic).digest();

        //id to socket mapping
        this.idKeyMapping = new Map();
        this.keySocketMapping = new Map();

        //peer identity informations
        this.idIdentityMapping = new Map();

        //unacknowledged messages
        this.unacknowledgedMessages = new Map();

        this.allowedNeighbours = new Set([...object.allowedNeighbours])

        this.swarm = new HS();

        this.swarm.join(this.topic, {
            announce: true,
            lookup: true
        });

        this.swarm.on("connection", (socket, info) => {
            const key = socket.remotePublicKey.toString("hex")
            if (this.keySocketMapping.has(key)) {
                let mappedSocket = this.keySocketMapping.get(key);
                mappedSocket.destroy();
            }
            this.keySocketMapping.set(key, socket);

            /*
            HELLO PROTOCOL
            once socket connection is establshed, each peer will send and receive a HELLO and a HELLO-ACK message in order to exchange protocol level identities
            */

            const helloMessage = {
                label: "HELLO",
                identity: object.identity,
                key: this.swarm.keyPair.publicKey.toString("hex")
            }
            socket.write(JSON.stringify(helloMessage) + "\n")

            let othersIdentity = null;
            socket.pipe(split2(JSON.parse))
                .on("data", (message) => {

                    if (message.label == "HELLO") {
                        console.log("[Hyperswarm/socket.on(data)] received HELLO ", message);

                        this.idKeyMapping.set(message.identity.id, message.key);
                        this.idIdentityMapping.set(message.identity.id, message.identity);
                        othersIdentity = message.identity;

                        const helloAckMessage = {
                            label: "HELLO-ACK",
                            identity: object.identity,
                            key: this.swarm.keyPair.publicKey.toString("hex")
                        }
                        socket.write(JSON.stringify(helloAckMessage) + "\n")
                        return;
                    }

                    if (message.label == "HELLO-ACK") {
                        console.log("[Hyperswarm] received HELLO-ACK ", message);
                        
                        this.idKeyMapping.set(message.identity.id, message.key);
                        this.idIdentityMapping.set(message.identity.id, message.identity);
                        othersIdentity = message.identity

                        //limiting connections based on topology
                        if(!this.allowedNeighbours.has(message.identity.id))return;

                        //connected only when HELLO-ACK is received
                        this.emitter.emit("connected", message.identity);
                        return;
                    }

                    if (message.label == "ACK") {
                        console.log("[Hyperswarm] received ACK", message)
                        let sentMessage = this.unacknowledgedMessages.get(message.id)
                        this.unacknowledgedMessages.delete(message.id)
                        this.emitter.emit("sent", sentMessage)
                        return;
                    }

                    //unwrap the message

                    //sending acknowledgement
                    let ackMessage = {
                        label: "ACK",
                        id: message.id
                    }
                    socket.write(JSON.stringify(ackMessage) + "\n")

                    this.emitter.emit("received", message)
                });

            socket.on("error", (error) => {
                // if (error.code == "ETIMEDOUT") {
                //     console.log("[Hyperswarm] disconnect due to ETIMEDOUT")
                //     this.disconnect(othersIdentity.id);
                //     return;
                // }
                this.emitter.emit("error", new Error("[Hyperswarm] socket error.", error))
            });

            /*
            socket.on("close", () => {
                console.log("disconnecting on close")
                //delete the key socket mapping
                this.disconnect(othersIdentity.id);
            });
            */
        });

        console.log("[Hyperswarm] communication online")
    }

    disconnect(id) {
        if (this.idKeyMapping.has(id)) {
            let key = this.idKeyMapping.get(id);
            this.idKeyMapping.delete(id);
            if (this.keySocketMapping.has(key)) {
                let socket = this.keySocketMapping.get(key);
                this.keySocketMapping.delete(key);
                if (socket) {
                    socket.destroy();
                    //limiting connections based on topology
                    if(!this.allowedNeighbours.has(id))return;
                    this.emitter.emit("disconnected", this.idIdentityMapping.get(id));
                }
            }
        }
    }

    getPeer(id){
        return this.idIdentityMapping.get(id) || null;
    }

    getPeers(){
        let peerList = [];
        this.idIdentityMapping.forEach((value, key)=>{
            peerList.push(value);
        })
        return peerList || null
    }

    send(message) {
        //wrap the message
       
        if(!this.idKeyMapping.has(message.receiver)){
            this.emitter.emit("dropped", message)
            return;
        }

        let receiverKey = this.idKeyMapping.get(message.receiver)
        let receiverSocket = this.keySocketMapping.get(receiverKey);
        receiverSocket.write(JSON.stringify(message) + "\n");

        //if the message is unacknowledged after timeout seconds, drop the message and disconnect peer
        this.unacknowledgedMessages.set(message.id, message);
        setTimeout(() => {
            if (this.unacknowledgedMessages.has(message.id)) {
                this.unacknowledgedMessages.delete(message.id)
                console.log("[Hyperswarm] disconnect due to ACK timeout")
                this.disconnect(message.receiver)
                this.emitter.emit("dropped", message)
            }
        }, this.timeout);
    }

    on(eventName, callback) {
        this.emitter.on(eventName, callback);
    }
}

export default Hyperswarm;