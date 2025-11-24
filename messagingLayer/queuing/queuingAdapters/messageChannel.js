import { EventEmitter } from "node:events";
import { MessageChannel as MC } from "node:worker_threads";

class MessageChannel{
    constructor(object){
        this.emitter = new EventEmitter();
        this.communicationAdapter = object.communicationAdapter;

        this.communicationAdapter.on("sent",(message)=>{
            this.emitter.emit("sent", message);
        })

        //incoming producer
        // this.communicationAdapter.on("received",(message)=>{
        //     this.emitter.emit("incomingQueued",message);
        // })

        this.communicationAdapter.on("connected",(identity)=>{
            this.emitter.emit("connected",identity);
        })

        this.communicationAdapter.on("disconnected",(identity)=>{
            this.emitter.emit("disconnected", identity);
        })

        this.communicationAdapter.on("error",(error)=>{
            this.emitter.emit("error",error);
        })

        //MessageChannel
        this.channel = new MC();
        this.producerPort = this.channel.port1;
        this.consumerPort = this.channel.port2;
        
        //outgoing consumer
        this.consumerPort.on("message",(message)=>{
            this.emitter.emit("outgoingDequeued",message);
            this.communicationAdapter.send(message);
        });

        //incoming producer
        this.communicationAdapter.on("received",(message)=>{
            this.consumerPort.postMessage(message);
            this.emitter.emit("incomingQueued",message);
        })

        //incoming consumer
        this.producerPort.on("message",message=>{
            this.emitter.emit("incomingDequeued",message);
            this.emitter.emit("received",message)
        })

        console.log("[MESSAGE CHANNEL] queue online")
    }

    //outgoing producer
    enqueue(message) {
        this.producerPort.postMessage(message);
        this.emitter.emit("outgoingQueued",message);
    }

    on(eventName, callback){
        this.emitter.on(eventName,callback);
    }
}

export default MessageChannel;