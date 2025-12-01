/*
TRACE-RETRACE-RELAY PROTOCOL
*/

//most recently encountered path first (MREPF)

import say from "say"

import {
    ulid
} from "ulid";
import {
    EventEmitter
} from "node:events";

class Router {
    constructor(object) {
        this.emitter = new EventEmitter();
        this.messagingAdapter = object.messagingAdapter;

        this.identity = object.identity;

        this.neighbours = new Map();
        this.traces = new Set();
        this.targetPathMapping = new Map();

        this.targetPendingMessagesMapping = new Map();

        this.messagingAdapter.on("connected", (identity) => {
            this.neighbours.set(identity.id, identity);
            this.emitter.emit("connected", identity);
            say.speak(`${this.identity.id} connected to ${identity.id}`)
        })

        this.messagingAdapter.on("disconnected", (identity) => {
            this.neighbours.delete(identity.id);
            this.emitter.emit("disconnected", identity);
        })

        this.messagingAdapter.on("sent", (message) => {
            this.emitter.emit("sent", message);
        })

        this.messagingAdapter.on("error", (error) => {
            this.emitter.emit("error", error);
        })

        this.messagingAdapter.on("incomingDequeued", (message) => {

            if (message.label == "TRACE") {
                if (this.identity.id == message.source) {
                    //if I receive my trace message
                    return;
                }

                message.trace.push(this.identity.id)

                //infer paths and clear pending
                console.log("[ROUTER] inferring paths from trace message ", message)
                for (let i = 0; i < message.trace.length - 1; i++) {
                    let path = message.trace.slice(i, message.trace.length);
                    path = path.reverse();
                    console.log(`path to  ${message.trace[i]} is ${path}`)

                    let pendingMessages = this.targetPendingMessagesMapping.get(message.trace[i]) || [];
                    for (let message of pendingMessages) {
                        message.source = this.identity.id;
                        message.target = message.receiver;

                        message.sender = this.identity.id
                        message.receiver = path[1];

                        message.label = "RELAY"
                        message.trace = path;
                        message.nextHopIndex = 1;

                        console.log("[ROUTE] INITIATING RELAY, CLEARING PENDING ", message)
                        this.messagingAdapter.enqueue(message);
                    }
                    this.targetPendingMessagesMapping.delete(message.trace[i]);
                    this.targetPathMapping.set(message.trace[i], path);
                }

                //block redundant traces
                if (this.traces.has(message.id)) {
                    console.log("[ROUTER] blocked trace ", message.id)
                    return;
                }

                console.log("[ROUTER] RECEIVED TRACE MESSAGE ", message)

                this.traces.add(message.id);

                // Am I the target?
                if (message.target == this.identity.id) {

                    // Build RETRACE message
                    const retraceMessage = {
                        label: "RETRACE",
                        id: message.id,
                        sender: this.identity.id,
                        receiver: message.trace[message.trace.length - 2],
                        source: this.identity.id,
                        target: message.source,
                        trace: message.trace,
                        nextHopIndex: message.trace.length - 2
                    };

                    console.log("[ROUTER] INITIATING RETRACE ", retraceMessage)

                    this.messagingAdapter.enqueue(retraceMessage);
                    return;
                }

                // flood TRACE to all neighbours except the sender
                for (const id of this.neighbours.keys()) {

                    let traceMessage = {
                        ...message
                    }
                    console.log("message before modifying sender and receiver", traceMessage)
                    if (id == traceMessage.sender) continue;

                    traceMessage.sender = this.identity.id;
                    traceMessage.receiver = id;

                    console.log("[ROUTER] broadcasting trace message ", traceMessage)
                    this.messagingAdapter.enqueue(traceMessage);
                }

                return;
            }


            if (message.label == "RETRACE") {
                console.log("[ROUTER] RECEIVED RETRACE MESSAGE", message)

                //infer paths
                console.log("[ROUTER] infering paths from retrace message ", message)
                for (let i = message.nextHopIndex + 1; i < message.trace.length; i++) {
                    let path = message.trace.slice(message.nextHopIndex, i + 1);
                    console.log(`path to  ${message.trace[i]} is ${path}`)

                    let pendingMessages = this.targetPendingMessagesMapping.get(message.trace[i]) || [];
                    for (let message of pendingMessages) {
                        message.source = this.identity.id;
                        message.target = message.receiver;

                        message.sender = this.identity.id
                        message.receiver = path[1];

                        message.label = "RELAY"
                        message.trace = path;
                        message.nextHopIndex = 1;

                        console.log("[ROUTE] INITIATING RELAY, CLEARING PENDING ", message)
                        this.messagingAdapter.enqueue(message);
                    }
                    this.targetPendingMessagesMapping.delete(message.trace[i]);

                    this.targetPathMapping.set(message.trace[i], path);
                }

                if (message.target == this.identity.id) {
                    return;
                }

                message.sender = this.identity.id;
                message.nextHopIndex = message.nextHopIndex - 1;
                message.receiver = message.trace[message.nextHopIndex];

                this.messagingAdapter.enqueue(message);
                console.log("[ROUTER] RELAYED RETRACE MESSAGE", message)
                return;
            }

            if (message.label == "RELAY") {
                console.log("[ROUTER] RECEIVED RELAY MESSAGE ", message);

                if (message.target == this.identity.id) {
                    //unwrap code goes here
                    this.emitter.emit("received", message)
                    return;
                }

                //if path exists, use newly encountered path
                if (this.targetPathMapping.has(message.target)) {
                    let path = this.targetPathMapping.get(message.target);

                    message.sender = this.identity.id;
                    message.receiver = path[1];
                    message.trace = path;
                    message.nextHopIndex = 1
                } else {
                    //continue on the current path
                    message.sender = this.identity.id;
                    message.nextHopIndex = message.nextHopIndex + 1;
                    message.receiver = message.trace[message.nextHopIndex]
                }

                console.log("[ROUTER] RELAYING RELAY MESSAGE ", message);
                this.messagingAdapter.enqueue(message);
                return;
            }

            this.emitter.emit("received", message);
        });

        console.log("[ROUTER] router online")
    }

    trace(receiver) {
        let traceId = ulid();
        for (let id of this.neighbours.keys()) {

            let traceMessage = {
                label: "TRACE",
                id: traceId,
                sender: this.identity.id,
                receiver: id,
                source: this.identity.id,
                target: receiver,
                trace: [this.identity.id]
            }

            this.traces.add(traceId)

            console.log("[ROUTER] broadcasting trace", traceMessage);

            this.messagingAdapter.enqueue(traceMessage);
        }
    }

    relayNoPath(message) {
        //assuming no path exists
        if (!this.targetPathMapping.has(message.receiver)) {
            console.log("[ROUTER] path not found ", message);
            let currentPendingList = this.targetPendingMessagesMapping.get(message.receiver) || [];
            this.targetPendingMessagesMapping.set(message.receiver, [...currentPendingList, message]);

            //initiate trace
            console.log("[ROUTER] INITIATING TRACE");
            let traceId = ulid();
            for (let id of this.neighbours.keys()) {

                let traceMessage = {
                    label: "TRACE",
                    id: traceId,
                    sender: this.identity.id,
                    receiver: id,
                    source: this.identity.id,
                    target: message.receiver,
                    trace: [this.identity.id]
                }

                this.traces.add(traceId)

                console.log("[ROUTER] BROADCASTING TRACE", traceMessage);

                this.messagingAdapter.enqueue(traceMessage);
            }
        }
    }

    /*
    relay(message) {
        //assuming path exists initially
        let path = this.targetPathMapping.get(message.receiver);

        message.source = this.identity.id;
        message.target = message.receiver;

        message.sender = this.identity.id
        message.receiver = path[1];

        message.label = "RELAY"
        message.trace = path;
        message.nextHopIndex = 1;

        console.log("[ROUTE] INITIATING RELAY ", message)
        this.messagingAdapter.enqueue(message);
    }

      send(message) {
        //if the receiver is a neighbour, send directly
        if (this.neighbours.has(message.receiver)) {
          console.log("[ROUTER/send(message)] sending directly to neighbour")
          this.messagingAdapter.enqueue(message);
        }

        //if the path is already mapped out
        if (this.idPathMapping.has(message.receiver)) {
          //relay message via that path, implementation pending
          console.log("[ROUTER] path found ", this.idPathMapping.get(message.receiver))
        }

        //trigger a trace
        for (let id of this.neighbours.keys()) {
          let traceMessage = {
            label: "TRACE",
            id: message.id,
            sender: this.identity.id,
            receiver: id,
            source: this.identity.id,
            target: message.receiver
          }

          this.messagingAdapter.enqueue(message);
        }
      }
    */

    on(eventName, callback) {
        this.emitter.on(eventName, callback);
    }
}

export default Router;