import Hyperswarm from "../messagingLayer/communication/communicationAdapters/hyperswarm.js";
import Queue from "../messagingLayer/queuing/queuingAdapters/queue.js";
import Router from "./routing/routing.js";
import {
    ulid
} from "ulid";

let identity = {
    id: "A",
    name: "someNameA"
};

let communication = new Hyperswarm({
    topic: "maaz",
    identity: identity

});

let queue = new Queue({
    communicationAdapter: communication
});

let router = new Router({
    identity:identity,
    messagingAdapter: queue
})

let once = false;

router.on("connected", (identity) => {
    console.log("[CONNECTED]", identity);
    if(once == true)return;
    // setTimeout(()=>{
    //     once = true
    //     console.log("tracing")
    //     router.trace("E");
    //     setTimeout(()=>{
    //         router.relay({
    //             id : ulid(),
    //             sender: "A",
    //             receiver: "E",
    //         })
    //     },20000)
    // },100)

    router.relayNoPath({
                id : ulid(),
                sender: "A",
                receiver: "E",
            })
});

router.on("disconnected", (identity) => {
    console.log("[DISCONNECTED]", identity);
});

router.on("error", (error) => {
    console.log("[ERROR]", error);
});
