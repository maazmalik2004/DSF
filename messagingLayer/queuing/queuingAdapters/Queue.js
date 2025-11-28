import { EventEmitter } from "node:events";

class Queue{
    constructor(object){
        this.emitter = new EventEmitter();

        this.outgoingQueue = [];
        this.incomingQueue = [];

        this.communicationAdapter = object.communicationAdapter;

        this.communicationAdapter.on("sent",(message)=>{
            this.emitter.emit("sent", message);
        })

        // incoming producer
        this.communicationAdapter.on("received",(message)=>{
            this.emitter.emit("received",message);
            this.incomingQueue.push(message);
            this.emitter.emit("incomingQueued",message);
        })

        this.communicationAdapter.on("connected",(identity)=>{
            this.emitter.emit("connected",identity);
        })

        this.communicationAdapter.on("disconnected",(identity)=>{
            this.emitter.emit("disconnected", identity);
        })

        this.communicationAdapter.on("error",(error)=>{
            this.emitter.emit("error",error);
        })

        //outgoing consumer
        setInterval(()=>{
            if(this.outgoingQueue.length > 0){
                let message = this.outgoingQueue.shift();
                this.emitter.emit("outgoingDequeued",message);
                this.communicationAdapter.send(message);
            }
        },1000);

        //incoming consumer
        setInterval(()=>{
            if(this.incomingQueue.length > 0){
                let message = this.incomingQueue.shift();
                this.emitter.emit("incomingDequeued",message);
            }
        },1000);

        console.log("[QUEUE] queue online")
    }

    //outgoing producer
    enqueue(message){
        this.outgoingQueue.push(message);
        this.emitter.emit("outgoingQueued",message);
    }

    on(eventName, callback){
        this.emitter.on(eventName, callback);
    }
}

export default Queue;