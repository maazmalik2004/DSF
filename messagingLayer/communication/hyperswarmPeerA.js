import Hyperswarm from "./communicationAdapters/hyperswarm.js";
import { ulid } from "ulid";

let identity = {
    id:"A",
    name:"A"
}

let communication = new Hyperswarm({
    topic: "maaz",
    identity: identity,
    timeout : 1000
});

communication.on("connected",identity => {
    console.log("[CONNECTED] ",identity);
})

communication.on("disconnected",identity => {
    console.log("[DISCONNECTED] ",identity);
})

communication.on("sent",message => {
    console.log("[SENT] ",message);
})

communication.on("received",message => {
    console.log("[RECEIVED] ",message);
})

communication.on("dropped",message => {
    console.log("[DROPPED] ",message);
})

communication.on("error",error => {
    console.log("[ERROR] ",error);
})

setInterval(()=>{
    communication.send({
        id: ulid(),
        sender : identity.id,
        receiver : "B"
    });

    console.log("getPeers",communication.getPeer("B"))
},5000)