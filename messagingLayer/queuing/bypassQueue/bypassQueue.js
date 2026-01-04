import {
    EventEmitter
} from "node:events";

class BypassQueue {
    constructor(object) {
        this.emitter = new EventEmitter();
        this.adapter = object.adapter;

        this.adapter.on("sent", (message) => {
            this.emitter.emit("sent", message);
        })

        this.adapter.on("dropped", (message) => {
            //console.log("[QUEUE] dropped in queue")
            this.emitter.emit("dropped", message);
        })

        //incoming producer
        this.adapter.on("received", (message) => {
            this.emitter.emit("incomingDequeued", message)
        })

        this.adapter.on("connected", (identity) => {
            this.emitter.emit("connected", identity);
        })

        this.adapter.on("disconnected", (identity) => {
            this.emitter.emit("disconnected", identity);
        })

        this.adapter.on("error", (error) => {
            this.emitter.emit("error", error);
        })

        //console.log("[Queue] queue online")
    }

    //outgoing producer
    enqueue(message) {
        this.adapter.send(message)
    }

    send(message){
        this.enqueue(message)
    }

    on(eventName, callback) {
        this.emitter.on(eventName, callback);
    }
}

export default BypassQueue;