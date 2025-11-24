import EventQueue from "./eventQueue.js";
import MessageChannel from "./messageChannel.js";
import MockCommunicationAdapter from "./mockCommunicationAdapter.js";

let communication = new MockCommunicationAdapter();
let queue = new EventQueue({
    communicationAdapter:communication
});
// let queue = new MessageChannel({
//     communicationAdapter:communication
// });


//register events

queue.on("sent",(message)=>{
    console.log("[SENT]",message);
});

//receiving a message
queue.on("received",(message)=>{
    console.log("[RECEIVED]",message);
});

queue.on("connected",(identity)=>{
    console.log("[CONNECTED]",identity);
});

queue.on("disconnected",(identity)=>{
    console.log("[DISCONNECTED]",identity);
});

queue.on("outgoingQueued",(message)=>{
    console.log("[OUTGOING-QUEUED]",message);
});

queue.on("outgoingDequeued",(message)=>{
    console.log("[OUTGOING-DEQUEUED]",message);
});

queue.on("incomingQueued",(message)=>{
    console.log("[INCOMING-QUEUED]",message);
});

queue.on("incomingDequeued",(message)=>{
    console.log("[INCOMING-DEQUEUED]",message);
});


communication.simulateConnect("PEER B")

let i = 0;
setInterval(()=>{
    communication.simulateIncoming(`[${i}]message`);
    i++
},3000);


// //sending a message
// let j = 0;
// setInterval(()=>{
//     queue.enqueue(`[${j}]message`);
//     j++;
// },10000);

// setInterval(()=>{
//     communication.simulateDisconnect("PEER B")
// },20000);
