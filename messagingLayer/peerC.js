import EventQueue from "./queuing/queuingAdapters/eventQueue.js";
import MessageChannel from "./queuing/queuingAdapters/messageChannel.js";
import Queue from "./queuing/queuingAdapters/queue.js";
import MockCommunicationAdapter from "./queuing/queuingAdapters/mockCommunicationAdapter.js";
import Hyperswarm
from "./communication/communicationAdapters/hyperswarm.js";

let identitity = {
    id: "someIdC",
    name: "someNameC"
};

let name = identitity.name;
// let communication = new MockCommunicationAdapter();
let communication = new Hyperswarm({
    topic: "my-test-topic",
    identity: identitity

});
// let queue = new EventQueue({
//     communicationAdapter:communication
// });
// let queue = new MessageChannel({
//     communicationAdapter:communication
// });
let queue = new Queue({
    communicationAdapter: communication
});

//register events

// queue.on("sent", (message) => {
//     console.log("[SENT]", message);
// });

// //receiving a message
// queue.on("received", (message) => {
//     console.log("[RECEIVED]", message);
// });

queue.on("connected", (identity) => {
    console.log("[CONNECTED]", identity);
});

// queue.on("disconnected", (identity) => {
//     console.log("[DISCONNECTED]", identity);
// });

// queue.on("outgoingQueued", (message) => {
//     console.log("[OUTGOING-QUEUED]", message);
// });

// queue.on("outgoingDequeued", (message) => {
//     console.log("[OUTGOING-DEQUEUED]", message);
// });

// queue.on("incomingQueued", (message) => {
//     console.log("[INCOMING-QUEUED]", message);
// });

// queue.on("incomingDequeued", (message) => {
//     console.log("[INCOMING-DEQUEUED]", message);
// });

queue.on("error", (error) => {
    console.log("[ERROR]", error);
});

// communication.simulateConnect("PEER B")


// //simulate incoming
// let i = 0;
// setInterval(() => {
//     communication.simulateIncoming(`[${i}]message`);
//     i++
// }, 3000);


//simulate outgoing
let j = 0;
setInterval(() => {
    queue.enqueue({
        sender: "someIdC",
        receiver: "someIdA",
        meow: "protocol level message",
        from: name,
        ts: Date.now()
    });
    queue.enqueue({
        sender: "someIdC",
        receiver: "someIdB",
        meow: "protocol level message",
        from: name,
        ts: Date.now()
    });
    j++;
}, 3000);

//simulate disconnect
// setInterval(()=>{
//     communication.simulateDisconnect("PEER B")
// },20000);