import Communication from "../../messagingLayer/communication/hyperswarm/hyperswarm.js";
import Queue from "../../messagingLayer/queuing/bypassQueue/byassQueue.js";
import Router from "../../protocolLayer/routing/routing.js";
import LoadBalancer from "../../servicesLayer/loadBalancer/loadBalancer.js";
import RateLimiter from "../../servicesLayer/rateLimiter/rateLimiter.js";

const id = process.argv[2];
const identity = {
    id:id,
    name:id
}

let topology = {
  "A": ["B"],
  "B": ["A", "C", "D"],
  "C": ["B", "E"],
  "D": ["B", "E"],
  "E": ["C", "D", "F"],
  "F": ["E"]
}

let communication = new Communication({
    identity:identity,
    topic:"DSFDemo",
    allowedNeighbours:new Set(topology[id])
})

let queue = new Queue({
    adapter:communication
})

let router = new Router({
    identity:identity,
    adapter:queue
})

let loadBalancer = new LoadBalancer({
    identity: identity,
    callback:async(request)=>{
        //simulating a request that takes 10 seconds
        await new Promise(resolve => setTimeout(resolve, 10000));
        return { message: "some response" };
    },
    adapter:router
});

let rateLimiter = new RateLimiter({
    adapter:loadBalancer,
    rate:15 //15 requests per second
})

if(id == "A"){
    setInterval(async()=>{
        let response = rateLimiter.send({
            message:"some request"
        })
        console.log(response)


        if(response){
            if(response.status == "FAILURE"){
                console.log("request was dropped")
            }else{
                console.log("response", response)
            }
        }else{
            console.log("request was rate limited and dropped")
        }
    })
}