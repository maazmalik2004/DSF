import Hyperswarm from "../messagingLayer/communication/communicationAdapters/hyperswarm.js";
import Queue from "../messagingLayer/queuing/queuingAdapters/byassQueue.js";
// import Queue from "../messagingLayer/queuing/queuingAdapters/queue.js";

import Router from "./routing/routing.js";
import {
    ulid
} from "ulid";

import fs from "fs";
let topology = JSON.parse(fs.readFileSync("./protocolLayer/topology.json","utf-8"));

let identity = {
    id: "A",
    name: "someNameA"
};

let reachablePeers = new Set();

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

router.on("connected", (identity) => {
    console.log("[CONNECTED]", identity);
});

router.on("disconnected", (identity) => {
    console.log("[DISCONNECTED]", identity);
});

router.on("error", (error) => {
    console.log("[ERROR]", error);
});

router.on("dropped",message => {
    console.log("[DROPPED] ",message)
})

router.on("reachable",id => {
    reachablePeers.add(id)
    console.log("[REACHABLE] ",id)
})

router.on("unreachable",id => {
    console.log("[UNREACHABLE] ",id)
})

setInterval(()=>{
    // if(!reachablePeers.has("F"))return;
    router.send({
                id : ulid(),
                sender: "A",
                receiver: "F",
            })
},30000)