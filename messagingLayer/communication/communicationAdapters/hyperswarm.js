import HS from "hyperswarm";
import {EventEmitter} from "node:events";
import crypto from "crypto";
import split2 from 'split2';
import utils from "../../../utils/utils.js"

class Hyperswarm {
    constructor(object) {
        this.emitter = new EventEmitter();

        this.timeout = object.timeout || 10000;

        //32 bytes topic (256 bits)
        this.topic = crypto.createHash("sha256").update(object.topic).digest();

        //id to socket mapping
        this.idKeyMapping = new Map();
        this.keySocketMapping = new Map();

        //peer identity informations
        this.idIdentityMapping = new Map();
       
        this.unacknowledgedMessages = new Map();

        //for connect-disconnect consistency
        this.idLatestConnectionIdMapping = new Map();

        this.swarm = new HS();

        this.swarm.join(this.topic, {
            announce: true,
            lookup: true
        });

        this.swarm.on("connection", (socket, info) => {
            const connectionId = utils.getRandomId();
            socket.connectionId = connectionId
            console.log("[HYPERSWARM] connection event on connectionId ",connectionId)
            console.log("[HYPERSWARM] we are ",info.client?"client":"server")

            socket.setKeepAlive(true, 1000);

            const key = socket.remotePublicKey.toString("hex")

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

            let othersIdentity = {
                id:null
            };
            
            let stream = socket.pipe(split2(JSON.parse));
            stream.on("data", (message) => {

                    if (message.label == "HELLO") {
                        console.log("[Hyperswarm/socket.on(data)] received HELLO, sending acknowledgement ", message);

                        const helloAckMessage = {
                            label: "HELLO-ACK",
                            identity: object.identity,
                            key: this.swarm.keyPair.publicKey.toString("hex")
                        }
                        socket.write(JSON.stringify(helloAckMessage) + "\n")
                        console.log("[HYPERSWARM] sent hello ack")
                        return;
                    }

                    if (message.label == "HELLO-ACK") {
                        console.log("[Hyperswarm] received HELLO-ACK ", message);

                        let previouslyConnected = this.idKeyMapping.has(message.identity.id)
                        console.log("previously...",previouslyConnected)
                        
                        this.idIdentityMapping.set(message.identity.id, message.identity);
                        
                        this.idKeyMapping.set(message.identity.id, message.key);
                        this.keySocketMapping.set(key, socket);

                        this.idLatestConnectionIdMapping.set(message.identity.id, connectionId)
                        
                        othersIdentity = message.identity
                        
                        if(!previouslyConnected){
                            this.emitter.emit("connected", message.identity)
                            console.log("[HYPERSWARM] connected ", message.identity)
                        }
                        return;
                    }

                    //if we receive a message from someone, we know they are connected

                    if (message.label == "ACK") {
                        let sentMessage = this.unacknowledgedMessages.get(message.id)
                        this.unacknowledgedMessages.delete(message.id)
                        this.emitter.emit("sent", sentMessage)
                        return;
                    }

                    //sending acknowledgement
                    let ackMessage = {
                        label: "ACK",
                        id: message.id
                    }
                    socket.write(JSON.stringify(ackMessage) + "\n")

                    this.emitter.emit("received", message)
                });

            socket.on("error", (error) => {
                if (error.code == "ETIMEDOUT") {
                    console.log("[Hyperswarm] ETIMEDOUT occured on connection ",connectionId)
                    if(connectionId == this.idLatestConnectionIdMapping.get(othersIdentity.id)){
                        this.disconnect(othersIdentity.id);
                    }
                    return;
                }
                console.log("[SOCKET ERROR] ",error)
            });

            socket.on("close", (error) => {
                console.log("[SOCKET CLOSE] closing because ", error)
                console.log("[HYPERSWARM] socket close event on connection ",connectionId)
                console.log("   → socket.destroyed:", socket.destroyed);
                console.log("   → socket.writable:", socket.writable);
                console.log("   → socket.readable:", socket.readable);
                if(connectionId == this.idLatestConnectionIdMapping.get(othersIdentity.id)){
                    this.disconnect(othersIdentity.id);
                }
            });

            socket.on("end", () => {
                console.log("[HYPERSWARM] socket END event (remote closed write stream) on", connectionId);
            });

            socket.on("finish", () => {
                console.log("[HYPERSWARM] socket FINISH event (local called .end()) on", connectionId);
            });

            socket.on("timeout", () => {
                console.log("[HYPERSWARM] socket TIMEOUT event on", connectionId);
            });
        });

        console.log("[Hyperswarm] communication online")
    }

    //we only emit a disconnect if the timeout(ack or otherwise) occurs on the latest connection
    disconnect(id) {
        if(this.idKeyMapping.has(id)){
            let key = this.idKeyMapping.get(id);
            this.idKeyMapping.delete(id);
            this.keySocketMapping.delete(key);

            if(this.idKeyMapping.size == 0){
                this.swarm.join(this.topic, {
                    announce: true,
                    lookup: true
                });
            }

            this.emitter.emit("disconnected", this.idIdentityMapping.get(id));
            console.log("[HYPERSWARM] disconnected ",id);   
        }     
    }

    send(message) {
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
                console.log("[Hyperswarm] ACK timeout occured on connection ",receiverSocket.connectionId)
                if(receiverSocket.connectionId == this.idLatestConnectionIdMapping.get(message.receiver)){
                    this.disconnect(message.receiver)
                }
                this.emitter.emit("dropped", message)
            }
        }, this.timeout);
    }

    on(eventName, callback) {
        this.emitter.on(eventName, callback);
    }
}

export default Hyperswarm;