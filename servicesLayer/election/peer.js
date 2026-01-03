import Communication from "../../messagingLayer/communication/hyperswarm/hyperswarm.js"
import Queue from "../../messagingLayer/queuing/bypassQueue/byassQueue.js"
import Router from "../../protocolLayer/routing/routing.js"
import App from "./election.js";

const id = process.argv[2];

let topology = {
  "A": ["B"],
  "B": ["A", "C", "D"],
  "C": ["B", "E"],
  "D": ["B", "E"],
  "E": ["C", "D", "F"],
  "F": ["E"]
}


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
                topic:"DSFelection",
                allowedNeighbours:new Set(topology[id])
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
    },50000)
}