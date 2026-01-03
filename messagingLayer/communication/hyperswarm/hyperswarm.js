import HS from "hyperswarm";
import {EventEmitter} from "node:events";
import crypto from "crypto";
import split2 from 'split2';
import utils from "../../../utils/utils.js"

class Hyperswarm {
    constructor(object) {
        this.allowedNeighbours = object.allowedNeighbours || null;
        console.log(this.allowedNeighbours)
        this.emitter = new EventEmitter();

        this.timeout = object.timeout || 2000;
        this.maxResendAttempts = object.maxResendAttempts || 10;

        //32 bytes topic (256 bits)
        this.topic = crypto.createHash("sha256").update(object.topic).digest();

        //id to socket mapping
        this.idSocketMapping = new Map();

        //peer identity informations
        this.idIdentityMapping = new Map();
       
        this.unacknowledgedMessages = new Map();

        //for connect-disconnect consistency
        this.idLatestConnectionIdMapping = new Map();

        this.encounteredMessages = new Set();

        this.swarm = new HS();

        this.swarm.join(this.topic, {
            announce: true,
            lookup: true
        });

        this.swarm.on("connection", (socket, info) => {
            const connectionId = utils.getRandomId();
            socket.connectionId = connectionId
            ////console.log("[HYPERSWARM] connection event on connectionId ",connectionId)
            ////console.log("[HYPERSWARM] we are ",info.client?"client":"server")

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

                        let previouslyConnected = this.idSocketMapping.has(message.identity.id)
                        //console.log("previously...",previouslyConnected)
                        
                        this.idIdentityMapping.set(message.identity.id, message.identity);
                        this.idSocketMapping.set(message.identity.id, socket)
                        this.idLatestConnectionIdMapping.set(message.identity.id, connectionId)
                        
                        othersIdentity = message.identity
                        
                        if(!previouslyConnected && (!this.allowedNeighbours || this.allowedNeighbours.has(message.identity.id))){
                            this.emitter.emit("connected", message.identity)
                            console.log("[HYPERSWARM] connected ", message.identity)
                        }
                        return;
                    }

                    //if we receive a message from someone, be it ACK or any other message, we know they are connected
                    if(!this.idSocketMapping.has(othersIdentity.id) && (!this.allowedNeighbours || this.allowedNeighbours.has(message.identity.id))){
                        this.emitter.emit("connected", othersIdentity)
                    }

                    if (message.label == "ACK") {
                        if(this.unacknowledgedMessages.has(message.communicationLevelId)){
                            let sentMessage = this.unacknowledgedMessages.get(message.communicationLevelId)
                            this.unacknowledgedMessages.delete(message.communicationLevelId)
                    
                            ////console.log("[HYPERSWARM] acknowledged message ",message)
                            this.emitter.emit("sent", sentMessage)
                        }
                        return;
                    }

                    //sending acknowledgement
                    let ackMessage = {
                        label: "ACK",
                        communicationLevelId: message.communicationLevelId
                    }
                    //we acknowledge on the latest socket connection
                    let latestSocket = this.idSocketMapping.get(othersIdentity.id)
                    //wont hurt to send the acknowledgement twice just to be sure, or even thrice- it will increase network traffic tho
                    latestSocket.write(JSON.stringify(ackMessage) + "\n")

                    if(!this.encounteredMessages.has(message.communicationLevelId)){
                        this.encounteredMessages.add(message.communicationLevelId)
                        ////console.log("[HYPERSWARM] received message ",message)
                        this.emitter.emit("received", message)
                    }
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

        ////console.log("[Hyperswarm] communication online")
    }

    //we only emit a disconnect if the timeout(ack or otherwise) occurs on the latest connection
    disconnect(id) {
        this.swarm.join(this.topic, {
            announce: true,
            lookup: true
        });
        if(this.idSocketMapping.has(id)){
            this.idSocketMapping.delete(id)
            this.emitter.emit("disconnected", this.idIdentityMapping.get(id));
            ////console.log("[HYPERSWARM] disconnected ",id);   
        }     
    }

    send(message) {
        //communication level id's must be unique
        message.communicationLevelId = message.communicationLevelId ||  utils.getRandomId();
        message.resendAttempts = message.resendAttempts || 0;
        
        if(!this.idSocketMapping.has(message.receiver)){
            this.emitter.emit("dropped", message)
            return;
        }

        let receiverSocket = this.idSocketMapping.get(message.receiver);

     
        ////console.log("[HYPERSWARM] sending message ",message)
        receiverSocket.write(JSON.stringify(message) + "\n");

        //if the message is unacknowledged after timeout seconds, drop the message and disconnect peer
        this.unacknowledgedMessages.set(message.communicationLevelId, message);
        setTimeout(() => {
            if (this.unacknowledgedMessages.has(message.communicationLevelId)) {
                //attempt resend
                if(message.resendAttempts < this.maxResendAttempts){
                    message.resendAttempts = message.resendAttempts + 1;
                    this.send(message)
                    return;
                }

                //if we have exhausted our resend attempts
                this.unacknowledgedMessages.delete(message.communicationLevelId)
                ////console.log("[Hyperswarm] ACK timeout occured on connection ",receiverSocket.connectionId)
                ////console.log("unacked message ",message)
                if(receiverSocket.connectionId == this.idLatestConnectionIdMapping.get(message.receiver)){
                    this.disconnect(message.receiver)
                }
               
                ////console.log("[HYPERSWARM] dropped message ",message)
                this.emitter.emit("dropped", message)
                console.log("[Hyperswarm] droppage detected",message)
                // process.exit()
            }
        }, this.timeout);
    }

    on(eventName, callback) {
        this.emitter.on(eventName, callback);
    }
}

export default Hyperswarm;
