
import Communication from "./hyperswarm.js"

const id = process.argv[2];

let adapter = new Communication({
            identity:{
                id:id
            },
            topic:"someetopic"
        })

let connectedPeers = new Set();
let counts = {
    sent:0,
    received:0,
    dropped:0
}

adapter.on("connected", identity => {
    connectedPeers.add(identity.id)
    // setTimeout(()=>{
    //     process.exit()
    // },90000)
})

adapter.on("disconnected", identity => {
    connectedPeers.delete(identity.id)
})

adapter.on("received", message => {
    counts.received++;
    console.log(counts)
})

adapter.on("dropped", message => {
    counts.dropped++;
    console.log(counts)
})

adapter.on("sent", message => {
    counts.sent++;
    console.log(counts)
})

if(id == "A"){
    setInterval(()=>{
        for(let peer of connectedPeers){
            adapter.send({
                id:JSON.stringify(Date.now()),
                receiver:peer,
                message:"HELLO WORLD",
                seq:counts.sent
            })
        }
    },1);
}