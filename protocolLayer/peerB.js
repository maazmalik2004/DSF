import Hyperswarm from "../messagingLayer/communication/communicationAdapters/hyperswarm.js";
import Queue from "../messagingLayer/queuing/queuingAdapters/byassQueue.js";
// import Queue from "../messagingLayer/queuing/queuingAdapters/queue.js";

import Router from "./routing/routing.js";

import fs from "fs";
import {
    ulid
} from "ulid";

let topology = JSON.parse(fs.readFileSync("./protocolLayer/topology.json","utf-8"));

let identity = {
    id: "B",
    name: "someNameB"
};

let communication = new Hyperswarm({
    topic: "maaz",
    identity: identity,
    allowedNeighbours:topology[identity.id]
});

let queue = new Queue({
    communicationAdapter: communication
});

let router = new Router({
    identity:identity,
    messagingAdapter: queue
})

let connectedPeers = new Set(["A","B","C","D","E","F"])
import visualizer from "./utils.js"

router.on("connected", (remoteIdentity) => {
    // visualizer.registerConnect(remoteIdentity.id, identity.id);
    connectedPeers.add(remoteIdentity.id)
    console.log("[CONNECTED]", remoteIdentity);
});

router.on("disconnected", (remoteIdentity) => {
    // visualizer.deleteConnect(remoteIdentity.id, identity.id);
    connectedPeers.delete(remoteIdentity.id)
    console.log("[DISCONNECTED]", remoteIdentity);
});

router.on("error", (error) => {
    console.log("[ERROR]", error);
});


router.on("reachable",id => {
    console.log("[REACHABLE] ",id)
})

router.on("unreachable",id => {
    console.log("[UNREACHABLE] ",id)
})

router.on("sent",message => {
    // visualizer.logEvent(message.id, 3)
    console.log("[SENT] ",message)
})

router.on("dropped",message => {
    // visualizer.logEvent(message.id, 4)
    // visualizer.logEvent(message.id, 4,null, null, message.reason)
    console.log("[DROPPED] ",message)
})

router.on("received",message => {
    // visualizer.logEvent(message.id, 2)
    console.log("[RECEIVED] ",message)
})

// setInterval(()=>{
//     for(let peer of connectedPeers){
//         // console.log("sending...",Date.now())
//         if(peer == identity.id && peer != "A")continue;
//         let id =  ulid();
//         // visualizer.logEvent(id, 1, identity.id, peer)
//         router.send({
//             id :id,
//             sender: identity.id,
//             receiver: peer,
//         })
//     }
// },2000)