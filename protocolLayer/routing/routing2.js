/*
TRACE-RETRACE-RELAY PROTOCOL
MREPF Most Recently Encountered Path First
*/

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

        this.connectedPeers = new Map();
        this.encounteredTraces = new Set();
        this.targetPathMapping = new Map();
        this.targetPendingMessagesMapping = new Map();
        this.reachablePeers = new Set();

        this.messagingAdapter.on("connected", (identity) => {
            this.connectedPeers.set(identity.id, identity);
            this.emitter.emit("connected", identity);
        })

        this.messagingAdapter.on("disconnected", (identity) => {
            this.connectedPeers.delete(identity.id);
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
                //trace cant flow through self
                if (this.identity.id == message.source) {
                    return;
                }

                //infer paths and clear pending
                console.log("[ROUTER] inferring paths from trace message ", message)
                for (let i = 0; i <= message.trace.length - 2; i++) {
                    let path = message.trace.slice(i, message.trace.length);
                    path = path.reverse();
                    this.targetPathMapping.set(message.trace[i], path);
                    console.log(`path to  ${message.trace[i]} is ${path}`)

                    //if not already reachable, it is now
                    if (!this.reachablePeers.has(message.trace[i])) {
                        this.reachablePeers.add(message.trace[i]);
                        this.emitter.emit("reachable", message.trace[i]);
                    }

                    let pendingMessages = this.targetPendingMessagesMapping.get(message.trace[i]) || [];
                    for (let message of pendingMessages) {
                        message.sender = this.identity.id
                        message.receiver = path[1];
                        message.trace = path;
                        message.nextHopIndex = 1;
                        this.messagingAdapter.enqueue(message);
                    }
                    this.targetPendingMessagesMapping.delete(message.trace[i]);
                }

                //block redundant traces while having extracted most recent path information
                if (this.encounteredTraces.has(message.id)) {
                    console.log("[ROUTER] blocked trace ", message)
                    return;
                }

                console.log("[ROUTER] received trace message ", message)

                this.encounteredTraces.add(message.id);

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

                    console.log("[ROUTER] initiating retrace ", retraceMessage)

                    this.messagingAdapter.enqueue(retraceMessage);
                    return;
                }

                message.trace.push(this.identity.id)
                // flood TRACE to all neighbours except the sender
                for (const id of this.connectedPeers.keys()) {

                    let traceMessage = {
                        ...message
                    }
                    if (id == traceMessage.sender) continue;

                    traceMessage.sender = this.identity.id;
                    traceMessage.receiver = id;

                    console.log("[ROUTER] flooding trace message ", traceMessage)
                    this.messagingAdapter.enqueue(traceMessage);
                }

                return;
            }


            if (message.label == "RETRACE") {
                console.log("[ROUTER] received retrace message", message)

                //infer paths
                console.log("[ROUTER] infering paths from retrace message ")
                for (let i = message.nextHopIndex + 1; i < message.trace.length; i++) {
                    let path = message.trace.slice(message.nextHopIndex, i + 1);
                    this.targetPathMapping.set(message.trace[i], path);
                    console.log(`path to  ${message.trace[i]} is ${path}`)

                    if (!this.reachablePeers.has(message.trace[i])) {
                        this.reachablePeers.add(message.trace[i]);
                        this.emitter.emit("reachable", message.trace[i]);
                    }

                    let pendingMessages = this.targetPendingMessagesMapping.get(message.trace[i]) || [];
                    for (let message of pendingMessages) {
                        message.sender = this.identity.id
                        message.receiver = path[1];
                        message.trace = path;
                        message.nextHopIndex = 1;
                        this.messagingAdapter.enqueue(message);
                    }
                    this.targetPendingMessagesMapping.delete(message.trace[i]);
                }

                //retrace message has returned successfully
                if (message.target == this.identity.id) {
                    return;
                }

                //forwarding
                message.sender = this.identity.id;
                message.nextHopIndex = message.nextHopIndex - 1;
                message.receiver = message.trace[message.nextHopIndex];

                this.messagingAdapter.enqueue(message);
                console.log("[ROUTER] forwarding retrace message", message)
                return;
            }

            if (message.label == "RELAY") {
                console.log("[ROUTER] received relay message ", message);

                //reached intended target
                if (message.target == this.identity.id) {
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

                console.log("[ROUTER] forwarding relay message ", message);
                this.messagingAdapter.enqueue(message);
                return;
            }

             if (message.label == "RELAY-NACK") {
                console.log("[ROUTER] received relay-nack message ", message);

                //invalidate path
                this.targetPathMapping.delete(message.unreachablePeer);

                if(this.reachablePeers.has(message.unreachablePeer)){
                    this.reachablePeers.delete(message.unreachablePeer);
                    this.emitter.emit("unreachable",message.unreachablePeer)
                }
                
                //reached intended target
                if (message.target == this.identity.id) {
                    this.trace(message.unreachablePeer);
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

                console.log("[ROUTER] forwarding relay-nack message ", message);
                this.messagingAdapter.enqueue(message);
                return;
            }

            this.emitter.emit("received", message);
        });

        this.messagingAdapter.on("dropped", message => {
            console.log("[ROUTER] dropped ", message)
            if (message.label == "RELAY") {
                //invalidate path
                this.targetPathMapping.delete(message.target);

                let path = this.targetPathMapping.get(message.source)
                let relayNackMessage = {
                    label: "RELAY-NACK",
                    id:message.id,
                    source: this.identity.id,
                    target: message.source,
                    sender: this.identity.id,
                    receiver:path[1],
                    trace : path,
                    nextHopIndex : 1,
                    unreachablePeer : message.target
                }
                this.messagingAdapter.enqueue(relayNackMessage);
                return
            }

            this.emitter.emit("dropped", message)
        })

        console.log("[ROUTER] router online")
    }

    trace(target) {
        let traceId = ulid();
        for (let id of this.connectedPeers.keys()) {

            let traceMessage = {
                label: "TRACE",
                id: traceId,
                sender: this.identity.id,
                receiver: id,
                source: this.identity.id,
                target: target,
                trace: [this.identity.id]
            }

            this.encounteredTraces.add(traceId)

            console.log("[ROUTER/trace()] broadcasting trace", traceMessage);

            this.messagingAdapter.enqueue(traceMessage);
        }
    }

    relay(message) {
        message.label = "RELAY"
        message.source = this.identity.id;
        message.target = message.receiver;
        message.reroutingAttempts = 0;

        //case 1 path doesn't exist
        if (!this.targetPathMapping.has(message.receiver)) {
            console.log("[ROUTER/relay()] path not found to ", message.receiver);

            let currentPendingList = this.targetPendingMessagesMapping.get(message.receiver) || [];
            currentPendingList.push(message)
            this.targetPendingMessagesMapping.set(message.receiver, currentPendingList);

            console.log("[ROUTER/relay()] initiating trace");
            this.trace(message.receiver)
            return;
        }

        // case 2 path exists
        let path = this.targetPathMapping.get(message.receiver);
        message.sender = this.identity.id
        message.receiver = path[1];
        message.trace = path;
        message.nextHopIndex = 1;

        console.log("[ROUTE/relay()] initiation relay ", message)
        this.messagingAdapter.enqueue(message);
    }

    send(message) {
        this.relay(message)
    }

    on(eventName, callback) {
        this.emitter.on(eventName, callback);
    }
}

export default Router;