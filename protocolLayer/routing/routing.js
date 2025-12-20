/*
TRACE-RETRACE-RELAY-REROUTE-ACK/NACK-REROUTE (TRRRANR) PROTOCOL
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

    this.timeout = object.timeout || 20000;
    //console.log(this.timeout)
    //lets have 3 max attempts
    this.maxReroutingAttempts = object.maxReroutingAttempts || 3

    this.encounteredTraces = new Set();
    this.unresolvedTraces = new Set();
    this.unresolvedRelays = new Map();

    this.targetPathMapping = new Map();
    this.targetPendingMessagesMapping = new Map();

    this.connectedPeers = new Map();
    this.reachablePeers = new Set();

    this.messagingAdapter.on("connected", (identity) => {
      // if not already connected, it is now
      if(!this.connectedPeers.has(identity.id)){
        this.connectedPeers.set(identity.id, identity);
        this.emitter.emit("connected", identity);
      }
      if(!this.reachablePeers.has(identity.id)){
        this.reachablePeers.add(identity.id);
        this.emitter.emit("reachable",identity.id);
      }
    })

    this.messagingAdapter.on("disconnected", (identity) => {
      //if already connected, it is now not
      if(this.connectedPeers.has(identity.id)){
        this.connectedPeers.delete(identity.id);
        this.emitter.emit("disconnected", identity);
      }
      if(this.reachablePeers.has(identity.id)){
        this.reachablePeers.delete(identity.id);
        this.emitter.emit("unreachable", identity.id)
      }
    })

    this.messagingAdapter.on("sent", (message) => {
      //nothing
    })

    this.messagingAdapter.on("error", (error) => {
      this.emitter.emit("error", error);
    })

    this.messagingAdapter.on("incomingDequeued", (message) => {

      if (message.label == "TRACE") {
        //trace cant flow through self
        if (message.source == this.identity.id) {
          return;
        }

        message.trace.push(this.identity.id)

        //infer paths and clear pending
        //console.log("[ROUTER] inferring paths from trace message ", message)
        for (let i = 0; i <= message.trace.length - 2; i++) {
          let path = message.trace.slice(i, message.trace.length);
          path = path.reverse();
          this.targetPathMapping.set(message.trace[i], path);
          //console.log(`path to  ${message.trace[i]} is ${path}`)

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
            //console.log("initiation relay during flushing during trace")
            this.messagingAdapter.enqueue(message);
          }
          this.targetPendingMessagesMapping.delete(message.trace[i]);
        }

        //block redundant traces while having extracted most recent path information
        if (this.encounteredTraces.has(message.id)) {
          //console.log("[ROUTER] blocked trace ", message)
          return;
        }

        //console.log("[ROUTER] received trace message ", message)

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

          //console.log("[ROUTER] initiating retrace ", retraceMessage)

          this.messagingAdapter.enqueue(retraceMessage);
          return;
        }

        // flood TRACE to all neighbours except the sender
        for (const id of this.connectedPeers.keys()) {

          let traceMessage = {
            ...message
          }
          if (id == traceMessage.sender) continue;

          traceMessage.sender = this.identity.id;
          traceMessage.receiver = id;

          //console.log("[ROUTER] flooding trace message ", traceMessage)
          this.messagingAdapter.enqueue(traceMessage);
        }

        return;
      }


      if (message.label == "RETRACE") {
        //console.log("[ROUTER] received retrace message", message)
        this.unresolvedTraces.delete(message.id)

        //infer paths
        //console.log("[ROUTER] infering paths from retrace message ")
        for (let i = message.nextHopIndex + 1; i < message.trace.length; i++) {
          let path = message.trace.slice(message.nextHopIndex, i + 1);
          this.targetPathMapping.set(message.trace[i], path);
          //console.log(`path to  ${message.trace[i]} is ${path}`)

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
            //console.log("initiation relay during flushing during retrace")
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
        //console.log("[ROUTER] forwarding retrace message", message)
        return;
      }

      if (message.label == "RELAY") {
        //console.log("[ROUTER] received relay message ", message);

        //reached intended target
        if (message.target == this.identity.id) {
          this.emitter.emit("received", message)
          
          let relayAckMessage = {
            label: "RELAY-ACK",
            id: message.id,
            sender:this.identity.id,
            receiver:message.source,
          }
          this.relay(relayAckMessage)
          return;
        }

        message.sender = this.identity.id;
        message.nextHopIndex = message.nextHopIndex + 1;
        message.receiver = message.trace[message.nextHopIndex]

        // //if path exists, use newly encountered path
        // if (this.targetPathMapping.has(message.target)) {
        //   let path = this.targetPathMapping.get(message.target);

        //   message.sender = this.identity.id;
        //   message.receiver = path[1];
        //   message.trace = path;
        //   message.nextHopIndex = 1
        // } else {
        //   //continue on the current path
        //   message.sender = this.identity.id;
        //   message.nextHopIndex = message.nextHopIndex + 1;
        //   message.receiver = message.trace[message.nextHopIndex]
        // }

        //console.log("[ROUTER] forwarding relay message ", message);
        this.messagingAdapter.enqueue(message);
        return;
      }

      if (message.label == "RELAY-ACK") {
        //console.log("[ROUTER] received relay-ack message ", message);

        //reached intended target
        if (message.target == this.identity.id) {
          if(this.unresolvedRelays.has(message.id)){
            this.emitter.emit("sent",this.unresolvedRelays.get(message.id))
            this.unresolvedRelays.delete(message.id)
          }
          return;
        }

        message.sender = this.identity.id;
        message.nextHopIndex = message.nextHopIndex + 1;
        message.receiver = message.trace[message.nextHopIndex];

        // //console.log("using MREPF ",this.targetPathMapping);
        // if (this.targetPathMapping.has(message.target)) {
        //   let path = this.targetPathMapping.get(message.target);

        //   message.sender = this.identity.id;
        //   message.receiver = path[1];
        //   message.trace = path;
        //   message.nextHopIndex = 1
        // } else {
        //   //continue on the current path
        //   message.sender = this.identity.id;
        //   message.nextHopIndex = message.nextHopIndex + 1;
        //   message.receiver = message.trace[message.nextHopIndex]
        // }

        //console.log("[ROUTER] forwarding relay-ack message ", message);
        this.messagingAdapter.enqueue(message);
        return;
      }

      if (message.label == "RELAY-NACK") {
        //console.log("[ROUTER] received relay-nack message ", message);

        this.invalidate(message.unreachablePeer)

        //reached intended target
        if (message.target == this.identity.id) {
          if(this.unresolvedRelays.has(message.id)){
            //console.log("dropped due to nack")
            let droppedMessage = this.unresolvedRelays.get(message.id)
            droppedMessage.reason = "received RELAY-NACK message "+JSON.stringify(droppedMessage);
            this.emitter.emit("dropped",droppedMessage)
            this.unresolvedRelays.delete(message.id)
          }
          return;
        }

        message.sender = this.identity.id;
        message.nextHopIndex = message.nextHopIndex + 1;
        message.receiver = message.trace[message.nextHopIndex];

        // //console.log("using MREPF ",this.targetPathMapping);
        // if (this.targetPathMapping.has(message.target)) {
        //   let path = this.targetPathMapping.get(message.target);

        //   message.sender = this.identity.id;
        //   message.receiver = path[1];
        //   message.trace = path;
        //   message.nextHopIndex = 1
        // } else {
        //   //continue on the current path
        //   message.sender = this.identity.id;
        //   message.nextHopIndex = message.nextHopIndex + 1;
        //   message.receiver = message.trace[message.nextHopIndex]
        // }

        //console.log("[ROUTER] forwarding relay-nack message ", message);
        this.messagingAdapter.enqueue(message);
        return;
      }

      // this.emitter.emit("received", message);
    });

    this.messagingAdapter.on("dropped", message => {
      //console.log("[ROUTER] dropped ", message)

      if (message.label == "RELAY" || message.label == "RELAY-ACK" || message.label == "RELAY-NACK") {

        //invalidate paths
        this.targetPathMapping.delete(message.target);
        this.targetPathMapping.delete(message.receiver);

        if (message.reroutingAttempts > this.maxReroutingAttempts) {
          //console.log("invalidation due to rerouting attempt exhaustion")
          this.invalidate(message.target)
        }

        message.reroutingAttempts = message.reroutingAttempts + 1;
        let currentPendingList = this.targetPendingMessagesMapping.get(message.target) || [];
        currentPendingList = [...currentPendingList.filter(m => m.id !== message.id), message];
        this.targetPendingMessagesMapping.set(message.target, currentPendingList);

        this.trace(message.target)
        return
      }
    })

    //console.log("[ROUTER] router online")
  }

  invalidate(target) {
    //invalidate path
    this.targetPathMapping.delete(target);

    //invalidate pending messages
    let currentPendingList = this.targetPendingMessagesMapping.get(target) || [];
    this.targetPendingMessagesMapping.delete(target)

    for (let item of currentPendingList) {
      if (item.label == "RELAY") {
        if (item.source != this.identity.id) {
          //sender and receiver will transform in relay function, initialize accordingly
          let relayNackMessage = {
            label: "RELAY-NACK",
            id: item.id,
            sender:this.identity.id,
            receiver:item.source,
            unreachablePeer:item.target
          }
          // this.messagingAdapter.enqueue(relayNackMessage)
          this.relay(relayNackMessage)
        } else {
          item.reason = "dropped due to invalidity of target"+JSON.stringify(item);
          this.emitter.emit("dropped", item)
        }
      }
      if (item.label == "RELAY-ACK" || item.label == "RELAY-NACK") {
        //we let it drop silently
      }
    }

    if (this.reachablePeers.has(target)) {
      this.reachablePeers.delete(target)
      this.emitter.emit("unreachable", target);
    }
  }

  trace(receiver) {
    //we dont want to send redundant traces for the same target
    let traceId = ulid();
    this.unresolvedTraces.add(traceId)
    setTimeout(() => {
      if (this.unresolvedTraces.has(traceId)) {
        this.unresolvedTraces.delete(traceId);
        console.log("invalidation occured due to trace timeout",JSON.stringify({traceId, receiver}))
        this.invalidate(receiver)
      }
    }, this.timeout)
    for (let id of this.connectedPeers.keys()) {

      let traceMessage = {
        label: "TRACE",
        id: traceId,
        sender: this.identity.id,
        receiver: id,
        source: this.identity.id,
        target: receiver,
        trace: [this.identity.id]
      }

      this.encounteredTraces.add(traceId)

      //console.log("[ROUTER/trace()] broadcasting trace", traceMessage);
      this.messagingAdapter.enqueue(traceMessage);
    }
    return traceId;
  }

  relay(message) {
    message.id = message.id || ulid();
    this.unresolvedRelays.set(message.id, message);
    message.label = message.label || "RELAY"
    message.source = this.identity.id;
    message.target = message.receiver;
    message.reroutingAttempts = 0;

    //loopback : if we try to send a message to ourselves. it can never be dropped and will always be sent
    //only applicable to relay messages
    if(message.label == "RELAY" && message.target == this.identity.id){
      message.sender = this.identity.id;
      message.receiver = this.identity.id;
      this.emitter.emit("received",message)
      return;
    }

    //case 1 path doesn't exist
    if (!this.targetPathMapping.has(message.receiver)) {
      //console.log("[ROUTER/relay()] path not found to ", message.receiver);

      let currentPendingList = this.targetPendingMessagesMapping.get(message.receiver) || [];
      currentPendingList.push(message)
      this.targetPendingMessagesMapping.set(message.receiver, currentPendingList);

      //console.log("[ROUTER/relay()] initiating trace");
      this.trace(message.receiver)
      return message.id;
    }

    // case 2 path exists
    let path = this.targetPathMapping.get(message.receiver);
    message.sender = this.identity.id
    message.receiver = path[1];
    message.trace = path;
    message.nextHopIndex = 1;

    //console.log("[ROUTE/relay()] initiating relay ", message)
    this.messagingAdapter.enqueue(message);
    return message.id;
  }

  send(message) {
    this.relay(message)
  }

  on(eventName, callback) {
    this.emitter.on(eventName, callback);
  }
}

export default Router;