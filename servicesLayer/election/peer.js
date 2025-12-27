import App from "./election.js";

const id = process.argv[2];

let election = new App({
    identity: {
        id:id
    }
});

election.on("elected", ({ electionId, elected }) => {
    console.log(`[ELECTED]Election ${electionId} completed. Leaders:`, elected);
});

election.on("crowned", ({ electionId }) => {
    console.log(`[CROWNED]I was elected as a leader in election ${electionId}!`);
});

if(id == "A"){
    setTimeout(async()=>{
        let result = await election.elect(2);
        console.log("Initiator sees result:", result.elected);
    },10000)
}