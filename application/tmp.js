// import Hyperswarm from "../messagingLayer/communication/communicationAdapters/hyperswarm.js";
// import Queue from "../messagingLayer/queuing/queuingAdapters/byassQueue.js";
// import Router from "../protocolLayer/routing/routing.js";
// import fs from "fs";
// let topology = JSON.parse(fs.readFileSync("./protocolLayer/topology.json", "utf-8"));

// let identity = {
//     id: ulid()
// };

// console.log("starting node ",identity.id);

// // Initialize communication layer
// let communication = new Hyperswarm({
//     topic: "maaz",
//     identity: identity,
//     allowedNeighbours: topology[identity.id]
// });

// // Initialize queue and router
// let queue = new Queue({
//     communicationAdapter: communication
// });

// let router = new Router({
//     identity: identity,
//     messagingAdapter: queue
// });

// // Event listeners
// router.on("connected", (remoteIdentity) => {
//     console.log("[CONNECTED]", remoteIdentity);
// });

// router.on("disconnected", (remoteIdentity) => {
//     console.log("[DISCONNECTED]", remoteIdentity);
// });

// router.on("error", (error) => {
//     console.log("[ERROR]", error);
// });

// router.on("reachable", (id) => {
//     console.log("[REACHABLE]", id);
// });

// router.on("unreachable", (id) => {
//     console.log("[UNREACHABLE]", id);
// });

// router.on("sent", (message) => {
//     console.log("[SENT]", message);
// });

// router.on("dropped", (message) => {
//     console.log("[DROPPED]", message);
// });

// router.on("received", (message) => {
//     console.log("[RECEIVED]", message);
// });

// // // Periodically send messages to all known connected peers
// // setInterval(() => {
// //     for (let peer of connectedPeers) {
// //         if (peer === identity.id) continue; // Skip self

// //         let messageId = ulid();
// //         //visualizer.logEvent(messageId, 1, identity.id, peer);
// //         router.send({
// //             id: messageId,
// //             sender: identity.id,
// //             receiver: peer,
// //         });
// //     }
// // }, 2000);

// import express from "express";

// const app = express();
// app.use(express.json());

// const port = 3000;

// app.listen(port,()=>{
//     console.log(`Control Plane running at http://localhost:${port}`);
// })

// let markedForDeletion = new Set();

// import orchestrator from "./containerOrchestration.js";
// import { ulid } from "ulid";

// let {port1,containerId} = await orchestrator.startContainer(ulid());
// let port2 = await orchestrator.startContainer(ulid());
// let port3 = await orchestrator.startContainer(ulid());

// console.log(port1)
// console.log(port2)
// console.log(port3)