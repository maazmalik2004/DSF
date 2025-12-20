import Hyperswarm from "../messagingLayer/communication/communicationAdapters/hyperswarm.js";
import Queue from "../messagingLayer/queuing/queuingAdapters/byassQueue.js";
// import Queue from "../messagingLayer/queuing/queuingAdapters/queue.js";

import Router from "./routing/routing.js";
import { ulid } from "ulid";

import fs from "fs";
import visualizer from "./utils.js";

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
    topic: "maaz",
    identity: identity,
    allowedNeighbours: topology[identity.id]
});

// Initialize queue and router
let queue = new Queue({
    communicationAdapter: communication
});

let router = new Router({
    identity: identity,
    messagingAdapter: queue
});

// Track connected peers (start with self to avoid self-messaging)
let connectedPeers = new Set([nodeId]); // Initialize with self

// Event listeners
router.on("connected", (remoteIdentity) => {
    //visualizer.registerConnect(remoteIdentity.id, identity.id);
    connectedPeers.add(remoteIdentity.id);
    console.log("[CONNECTED]", remoteIdentity);
});

router.on("disconnected", (remoteIdentity) => {
    //visualizer.deleteConnect(remoteIdentity.id, identity.id);
    connectedPeers.delete(remoteIdentity.id);
    console.log("[DISCONNECTED]", remoteIdentity);
});

router.on("error", (error) => {
    console.log("[ERROR]", error);
});

router.on("reachable", (id) => {
    console.log("[REACHABLE]", id);
});

router.on("unreachable", (id) => {
    console.log("[UNREACHABLE]", id);
});

router.on("sent", (message) => {
    //visualizer.logEvent(message.id, 3);
    console.log("[SENT]", message);
});

router.on("dropped", (message) => {
    //visualizer.logEvent(message.id, 4, null, null, message.reason);
    console.log("[DROPPED]", message);
});

router.on("received", (message) => {
    //visualizer.logEvent(message.id, 2);
    console.log("[RECEIVED]", message);
});

// Periodically send messages to all known connected peers
setInterval(() => {
    for (let peer of connectedPeers) {
        if (peer === identity.id) continue; // Skip self

        let messageId = ulid();
        //visualizer.logEvent(messageId, 1, identity.id, peer);
        router.send({
            id: messageId,
            sender: identity.id,
            receiver: peer,
        });
    }
}, 2000);