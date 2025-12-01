import Hyperswarm from "../messagingLayer/communication/communicationAdapters/hyperswarm.js";
import Queue from "../messagingLayer/queuing/queuingAdapters/queue.js";
import Router from "./routing/routing.js";

let identity = {
    id: "C",
    name: "someNameC"
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

router.on("connected", (identity) => {
    console.log("[CONNECTED]", identity);
});

router.on("disconnected", (identity) => {
    console.log("[DISCONNECTED]", identity);
});

router.on("error", (error) => {
    console.log("[ERROR]", error);
});
