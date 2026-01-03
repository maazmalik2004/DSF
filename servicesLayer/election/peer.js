import Communication from "../../messagingLayer/communication/communicationAdapters/hyperswarm.js"
import Queue from "../../messagingLayer/queuing/queuingAdapters/byassQueue.js"
import Router from "../../protocolLayer/routing/routing.js"
import App from "./election.js";

const id = process.argv[2];

let election = new App({
    identity: {
        id:id
    },
    adapter:new Router({
        identity:{
            id:id
        },
        adapter:new Queue({
            adapter:new Communication({
                identity:{
                    id:id
                },
                topic:"DSFelection"
            })
        })
    })
});

election.on("elected", ({ electionId, elected }) => {
    console.log(`[ELECTED]Election ${electionId} completed. Leaders:`, elected);
});

election.on("crowned", ({ electionId }) => {
    console.log(`[CROWNED]I was elected as a leader in election ${electionId}!`);
});

if(id == "A"){
    setTimeout(async()=>{
        let result = await election.elect(5);
        console.log("Initiator sees result:", result.elected);
    },20000)
}