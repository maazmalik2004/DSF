import Hyperswarm from "../messagingLayer/communication/communicationAdapters/hyperswarm.js";
import Queue from "../messagingLayer/queuing/queuingAdapters/byassQueue.js";

import Router from "./routing/routing.js";
import { ulid } from "ulid";

import fs from "fs";
import { count } from "console";

// Read topology
let topology = JSON.parse(fs.readFileSync("./protocolLayer/topology.json", "utf-8"));

// Get identity ID from command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error("Error: Please provide a node ID as a command line argument.");
    console.error("Example: node script.js A");
    process.exit(1);
}

const nodeId = args[0].toUpperCase(); // e.g., "A", "B", etc.

// Validate that the ID exists in topology
if (!topology[nodeId]) {
    console.error(`Error: Node ID "${nodeId}" not found in topology.json`);
    process.exit(1);
}

// Create identity object — name is redundant, so we generate a friendly one
let identity = {
    id: nodeId,
    name: `Node ${nodeId}` // You can change this format if you want
};

console.log(`Starting node with identity: ${JSON.stringify(identity)}`);

// Initialize communication layer
let communication = new Hyperswarm({
    topic: "DSFNewRouter",
    identity: identity,
    allowedNeighbours: new Set(topology[identity.id])
});

// Initialize queue and router
let queue = new Queue({
    adapter: communication
});

let router = new Router({
    identity: identity,
    adapter: queue
});

let connectedCount = 0;
router.on("connected", (remoteIdentity) => {
    connectedCount++;
    console.log("[CONNECTED]", remoteIdentity);
});

router.on("disconnected", (remoteIdentity) => {
    console.log("[DISCONNECTED]", remoteIdentity);
});

// router.on("error", (error) => {
//     console.log("[ERROR]", error);
// });

// router.on("reachable", (id) => {
//     console.log("[REACHABLE]", id);
// });

// router.on("unreachable", (id) => {
//     console.log("[UNREACHABLE]", id);
// });
let counts = {
    attempted:0,
    sent:0,
    received:0,
    dropped:0
}

router.on("sent", (message) => {
    counts.sent++;
    console.log(counts)
    console.log("[SENT]", message);
});

router.on("dropped", (message) => {
    counts.dropped++;
    console.log(counts)
    console.log("[DROPPED]", message);
});

router.on("received", (message) => {
    counts.received++;
    console.log(counts)
    console.log("[RECEIVED]", message);
});


if(nodeId == "A"){  
    // setTimeout(() => {
    //         router.send({
    //             target: "F",
    //         });
    // }, 20000);
    setInterval(() => {
        if(connectedCount == 0)return;
        counts.attempted++;
        console.log(counts)
        router.send({
            target: "F",
        });
    }, 25);
}