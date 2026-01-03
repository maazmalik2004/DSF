import { EventEmitter } from "node:events";

class EventQueue{
    constructor(object){
        this.emitter = new EventEmitter();
        this.communicationAdapter = object.communicationAdapter;

        this.communicationAdapter.on("sent",(message)=>{
            this.emitter.emit("sent", message);
        })

        //incoming producer
        this.communicationAdapter.on("received",(message)=>{
            this.emitter.emit("incomingQueued",message);
            this.emitter.emit("incomingQueuedInternal",message);
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
        this.emitter.on("outgoingQueuedInternal",(message)=>{
            this.emitter.emit("outgoingDequeued",message)
            this.communicationAdapter.send(message)
        });

        //incoming consumer
        this.emitter.on("incomingQueuedInternal",(message)=>{
            this.emitter.emit("incomingDequeued",message);
            this.emitter.emit("received",message);
        })

        console.log("[Queue] queue online")
    }

    //outgoing producer
    enqueue(message){
        this.emitter.emit("outgoingQueued",message);
        this.emitter.emit("outgoingQueuedInternal",message);
    }

    on(eventName, callback){
        this.emitter.on(eventName, callback);
    }
}

export default EventQueue;