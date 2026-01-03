
import Communication from "../../messagingLayer/communication/hyperswarm/hyperswarm.js"
import Queue from "../../messagingLayer/queuing/bypassQueue/byassQueue.js"
import Router from "../../protocolLayer/routing/routing.js"
import LoadBalancer from "./loadBalancer.js";
import RateLimiter from "../rateLimiter/rateLimiter.js"

const id = process.argv[2];

let topology = {
  "A": ["B"],
  "B": ["A", "C", "D"],
  "C": ["B", "E"],
  "D": ["B", "E"],
  "E": ["C", "D", "F"],
  "F": ["E"]
}


let router = new Router({
        identity:{
            id:id
        },
        adapter:new Queue({
            adapter:new Communication({
                identity:{
                    id:id
                },
                topic:"DSFLoadBalancer",
                allowedNeighbours: new Set(topology[id])
            })
        })
    })

let loadBalancer = new LoadBalancer({
    identity: {
        id:id
    },
    callback:async(request)=>{
        await new Promise(resolve => setTimeout(resolve, 10000));
        return { message: "some response" };
    },
    adapter:router,
    name:"myRouter"
});

let rateLimiter = new RateLimiter({
    adapter:loadBalancer,
    rate:15
})

let counts = {
    totalCount: 0,
    successCount : 0
}

// if(id == "A"){
//     setTimeout(()=>{
//      setInterval(async ()=>{
//         counts.totalCount++;
//         let response = await loadBalancer.send({
//             meow:"some request",
//         })
    
//         console.log("[PEER] response ", response)
//         if(response.status != "FAILURE"){
//             counts.successCount++;
//         }else{
//             console.log("ULULU")
//             process.exit()
//         }
//         console.log("[APP] counts",counts)
//     },1000)
// },0)
// }


if(id == "A"){
    setTimeout(()=>{
     setInterval(async ()=>{
        counts.totalCount++;
        let response = await rateLimiter.send({
            meow:"some request",
        })
    
        console.log("[PEER] response ", response)
        if(response && response.status != "FAILURE"){
            counts.successCount++;
        }else{
            console.log("[APP] request dropped/failed")
        }
        console.log("[APP] counts",counts)
    },50)
},0)
}