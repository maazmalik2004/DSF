import { EventEmitter } from "node:events";
import utils from "../../utils/utils.js"

class Router{
    constructor(object){
        this.emitter = new EventEmitter();
        this.adapter = object.adapter;
        this.identity = object.identity
        this.maxReroutingAttempts = object.maxReroutingAttempts || 3;
        this.timeout = object.timeout || 20000

        this.targetPathMapping = new Map();
        this.encounteredTraces = new Set();
        this.unresolvedTraces = new Set();
        this.targetPendingMessagesMapping = new Map();
        this.unresolvedRelays = new Map();
        // let activeTraces = new Set();

        this.connectedPeers = new Set();
        this.reachablePeers = new Set();
        this.adapter.on("connected",identity=>{
            if(!this.connectedPeers.has(identity.id)){
                this.connectedPeers.add(identity.id);
                this.emitter.emit("connected", identity);
            }

            if(!this.reachablePeers.has(identity.id)){
                this.reachablePeers.add(identity.id)
                this.emitter.emit("reachable", identity.id)
            }
        })
        this.adapter.on("disconnected",identity=>{
            if(this.connectedPeers.has(identity.id)){
                this.connectedPeers.delete(identity.id)
                this.emitter.emit("disconnected", identity)
            }

            if(this.reachablePeers.has(identity.id)){
                this.reachablePeers.delete(identity.id)
                this.emitter.emit("unreachable", identity.id)
            }
        })

        this.adapter.on("incomingDequeued",message => {
            if(message.label == "TRACE"){
                if(message.source == this.identity.id){
                    //this can create nasty looped paths if not returned
                    return;
                }

                message.trace.push(this.identity.id);

                //infer paths and clear pending
                for(let i = 0;i<=message.trace.length-2;i++){
                    let inferredPath = message.trace.slice(i, message.trace.length);
                    inferredPath.reverse();
                    //console.log("[ROUTER] inferred path ",message.trace[i]+"=>"+inferredPath);
                    this.targetPathMapping.set(message.trace[i], inferredPath);

                    if(!this.reachablePeers.has(message.trace[i])){
                        this.reachablePeers.add(message.trace[i])
                        this.emitter.emit("reachable", message.trace[i])
                    }

                    let pendingMessages = this.targetPendingMessagesMapping.get(message.trace[i])||[];
                    this.targetPendingMessagesMapping.delete(message.trace[i])
                    for(let item of pendingMessages){
                        item.path = inferredPath;
                        item.nextHopIndex = 1;
                        item.sender = this.identity.id
                        item.receiver = item.path[1];
                        //console.log("[ROUTER] sending pending message ",item)
                        this.adapter.send(item);
                    }
                }

                if(this.encounteredTraces.has(message.id))return;
                this.encounteredTraces.add(message.id);

                if(message.target == this.identity.id){
                    //console.log("[ROUTER] received trace message, initiating retrace", message)
                    let retraceMessage = {
                        label:"RETRACE",
                        id:message.id,
                        source:this.identity.id,
                        target:message.source
                    }
                    //console.log("[ROUTER] sending retrace message ", retraceMessage)
                    this.helperRelay(retraceMessage);
                    return;
                }

                //flood ahead
                //console.log("[ROUTER] received and flooding trace message", message)
                let originalSender = message.sender;
                message.sender = this.identity.id;
                for(let peer of this.connectedPeers){
                    if(peer == originalSender)continue;
                    message.receiver = peer;
                    this.adapter.send(message);
                }
                return;
            }
            if(message.label == "RETRACE"){
                //infer paths and clear pending
                for(let i = 0; i<message.nextHopIndex; i++){
                    let inferredPath = message.path.slice(i, message.nextHopIndex+1);
                    inferredPath.reverse();
                    //console.log("[ROUTER] inferred path during retrace",message.path[i]+"=>"+inferredPath);
                    this.targetPathMapping.set(message.path[i], inferredPath);

                    if(!this.reachablePeers.has(message.path[i])){
                        this.reachablePeers.add(message.path[i])
                        this.emitter.emit("reachable", message.path[i])
                    }

                    let pendingMessages = this.targetPendingMessagesMapping.get(message.path[i])||[];
                    this.targetPendingMessagesMapping.delete(message.path[i])
                    for(let item of pendingMessages){
                        item.path = inferredPath;
                        item.nextHopIndex = 1;
                        item.sender = this.identity.id
                        item.receiver = inferredPath[1];
                        //console.log("[ROUTER] sending pending message ",item)
                        this.adapter.send(item);
                    }
                }

                if(message.target == this.identity.id){
                    this.unresolvedTraces.delete(message.id)
                    //console.log("[ROUTER] received retrace message")
                    return;
                }

                message.sender = this.identity.id;
                message.nextHopIndex = message.nextHopIndex + 1;
                message.receiver = message.path[message.nextHopIndex];

                //console.log("[ROUTER] forwarding retrace message ", message)
                this.adapter.send(message);
                return;
            }
            if(message.label == "RELAY"){
                //if it is intended for me
                if(message.target == this.identity.id){
                    //console.log("[ROUTER] received message",message);
                    this.emitter.emit("received", message);
                    let relayAckMessage={
                        label:"RELAY-ACK",
                        id:message.id,
                        source:this.identity.id,
                        target:message.source
                    }
                    //console.log("[ROUTER] sending relay ack ", relayAckMessage)
                    this.helperRelay(relayAckMessage)
                    return;
                }

                //console.log("[ROUTER] received message to forward",message);
                //MREPF- Most Recently Encountered Path First
                message.sender = this.identity.id;
                if(this.targetPathMapping.has(message.target)){
                    let path = this.targetPathMapping.get(message.target)
                    message.path = path
                    message.nextHopIndex = 1;
                    message.receiver = path[1];
                }else{
                    message.nextHopIndex = message.nextHopIndex + 1;
                    message.receiver = message.path[message.nextHopIndex];
                }

                //console.log("[ROUTER] forwarding relay message",message);
                this.adapter.send(message)
                return;
            }
            if(message.label == "RELAY-ACK"){
                if(message.target == this.identity.id){
                    //console.log("[ROUTER] received relay ack", message)
                    let originalMessage = this.unresolvedRelays.get(message.id)
                    this.unresolvedRelays.delete(message.id)
                    this.emitter.emit("sent", originalMessage);
                    return;
                }

                message.sender = this.identity.id;
                message.nextHopIndex = message.nextHopIndex+1;
                message.receiver = message.path[message.nextHopIndex];

                //console.log("[ROUTER] forwarding relay ACK", message)
                this.adapter.send(message)
            }
            if(message.label == "RELAY-NACK"){
                if(message.target == this.identity.id){
                    //console.log("[ROUTER] received relay nack ", message)
                    let originalMessage = this.unresolvedRelays.get(message.id)
                    this.targetPathMapping.delete(originalMessage.target);
                    this.emitter.emit("dropped", originalMessage);
                    return;
                }

                message.sender = this.identity.id;
                message.nextHopIndex = message.nextHopIndex+1;
                message.receiver = message.path[message.nextHopIndex];

                //console.log("[ROUTER] forwarding relay NACK", message)
                this.adapter.send(message)
            }
        })

        this.adapter.on("dropped",message => {
            //console.log("[ROUTER] dropped message ", message)
            message.reroutingAttempts = message.reroutingAttempts || 0;
            this.targetPathMapping.delete(message.target)

            if(message.label == "RELAY"){
                //attempt reroute
                if(message.reroutingAttempts < this.maxReroutingAttempts){
                    //console.log("[ROUTER] attempting rerouting on message ",message)
                    message.reroutingAttempts = message.reroutingAttempts + 1;
                    this.helperRelay(message)
                    return;
                }

                //send nack
                //console.log("[ROUTER] dropped message ", message)
                let relayNackMessage = {
                    label:"RELAY-NACK",
                    id:message.id,
                    source:this.identity.id,
                    target:message.source,
                    sender:this.identity.id,
                }
                //console.log("[ROUTER] sending nack ", relayNackMessage)
                this.helperRelay(relayNackMessage)
            }

            if(message.label == "RELAY-ACK"){
                //attempt reroute
                if(message.reroutingAttempts < this.maxReroutingAttempts){
                    //console.log("[ROUTER] attempting rerouting on message ",message)
                    message.reroutingAttempts = message.reroutingAttempts + 1;
                    this.helperRelay(message)
                }
                //otherwise let it drop silently
            }

            if(message.label == "RELAY-NACK"){
                //attempt reroute
                if(message.reroutingAttempts < this.maxReroutingAttempts){
                    //console.log("[ROUTER] attempting rerouting on message ",message)
                    message.reroutingAttempts = message.reroutingAttempts + 1;
                    this.helperRelay(message)
                }
                //otherwise let it drop silently
            }
        })
    }

    trace(target){
        // //for limiting trace messages
        // if(this.activeTraces.has(target))return;
        // this.activeTraces.add(target);
        let traceId = utils.getRandomId();
        this.encounteredTraces.add(traceId)
        this.unresolvedTraces.add(traceId)
        let traceMessage = {
            label:"TRACE",
            id:traceId,
            source:this.identity.id,
            target:target,
            sender:this.identity.id,
            trace:[this.identity.id]
        }

        for(let peer of this.connectedPeers){
            traceMessage.receiver = peer; 
            //console.log("[ROUTER] flooding trace message ", traceMessage)
            this.adapter.send(traceMessage);
        }

        setTimeout(()=>{
            //console.log("[ROUTER] trace timeout occured ", traceId)
            if(this.unresolvedTraces.has(traceId)){
                this.unresolvedTraces.delete(traceId);
                
                //nack all pending
                let pendingMessages = this.targetPendingMessagesMapping.get(target)||[];
                this.targetPendingMessagesMapping.delete(target) 
                this.targetPathMapping.delete(target);
                for(let item of pendingMessages){
                    if(item.label == "RELAY"){
                        let relayNackMessage = {
                            label:"RELAY-NACK",
                            id:item.id,
                            source:this.identity.id,
                            target:item.source,
                            sender:this.identity.id
                        }
                        this.helperRelay(relayNackMessage)
                    }
                }
            }
        },this.timeout)
    }

    send(message){
        this.relay(message)
    }

    helperRelay(message){
        //loopback
        if(message.target == this.identity.id){
            //console.log("[ROUTER] message in helper relay loopback condition ", message)
            if(message.label == "RELAY-ACK"){
                //console.log("[ROUTER] received relay ack ",message)
                this.emitter.emit("sent", this.unresolvedRelays.get(message.id))
                this.unresolvedRelays.delete(message.id)
            }
            if(message.label == "RELAY-NACK"){
                //console.log("[ROUTER] received relay nack ",message)
                let originalMessage = this.unresolvedRelays.get(message.id)
                this.unresolvedRelays.delete(message.id)
                this.targetPathMapping.delete(originalMessage.target)
                this.emitter.emit("dropped", originalMessage)
            }
        }

        // if(message.source == this.identity.id && message.label == "RELAY"){
        //     this.unresolvedRelays.set(message.id, message)
        // }

        if(this.targetPathMapping.has(message.target)){
            let path = this.targetPathMapping.get(message.target);
            message.sender = this.identity.id;
            message.receiver = path[1];
            message.path = path;
            message.nextHopIndex = 1;

            this.adapter.send(message)
        }else{
            let pendingMessages = this.targetPendingMessagesMapping.get(message.target) || [];
            pendingMessages.filter((item)=>item.id != message.id)
            pendingMessages.push(message);
            this.targetPendingMessagesMapping.set(message.target, pendingMessages);

            this.trace(message.target);
        }
    }

    relay(message){
        /*
        message = {
            target,
            ...other application level data
        }
        */

        //loopback- no relay acknowledgement needed
        if(message.target == this.identity.id){
            //console.log("[ROUTER] loopback triggered ",message)
            let relayId = message.id || utils.getRandomId();
            let relayMessage = {
                label:"RELAY",
                id:relayId,
                source: this.identity.id,
                target: this.identity.id,
                sender: this.identity.id,
                receiver: this.identity.id,
                applicationMessage:message
            }
            this.emitter.emit("sent",relayMessage)
            this.emitter.emit("received",relayMessage)
            return;
        }

        //if path exists [source, hop1, hop2, hop3... , target]
        if(this.targetPathMapping.has(message.target)){
            let path = this.targetPathMapping.get(message.target)
            let relayId = message.id || utils.getRandomId();
            let relayMessage = {
                label:"RELAY",
                id:relayId,
                source: this.identity.id,
                target:message.target,
                sender: this.identity.id,
                receiver: path[1],
                nextHopIndex: 1,
                path: path,
                applicationMessage:message,
            }
            this.unresolvedRelays.set(relayId, relayMessage)
            //console.log("[ROUTER] sending relay message ",relayMessage)
            this.adapter.send(relayMessage);
        }else{
            let relayId = message.id || utils.getRandomId();
            let relayMessage = {
                label:"RELAY",
                id:relayId,
                source: this.identity.id,
                target:message.target,
                sender: this.identity.id,
                applicationMessage:message,
            }

            this.unresolvedRelays.set(relayId, relayMessage)
            
            //console.log("[ROUTER] pushing relay message to pending ",relayMessage)
            let pendingMessages = this.targetPendingMessagesMapping.get(message.target)||[];
            pendingMessages.push(relayMessage)
            this.targetPendingMessagesMapping.set(message.target,pendingMessages);

            this.trace(message.target);
        }
    }

    on(eventName, callback) {
        this.emitter.on(eventName, callback);
    }
}

export default Router;