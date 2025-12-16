import { EventEmitter } from "node:events";

class BypassQueue{
    constructor(object){
        this.emitter = new EventEmitter();
        this.communicationAdapter = object.communicationAdapter;

        this.communicationAdapter.on("sent",(message)=>{
            this.emitter.emit("sent", message);
        })

        this.communicationAdapter.on("dropped",(message)=>{
            console.log("[QUEUE] dropped in queue")
            this.emitter.emit("dropped", message);
        })

        //incoming producer
        this.communicationAdapter.on("received",(message)=>{
           this.emitter.emit("incomingDequeued",message)
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

        console.log("[Queue] queue online")
    }

    //outgoing producer
    enqueue(message){
        this.communicationAdapter.send(message)
    }

    on(eventName, callback){
        this.emitter.on(eventName, callback);
    }
}

export default BypassQueue;