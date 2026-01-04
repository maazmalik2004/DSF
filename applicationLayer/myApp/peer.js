//imports
import Communication from "../../messagingLayer/communication/hyperswarm/hyperswarm.js";
import Queue from "../../messagingLayer/queuing/bypassQueue/byassQueue.js";
import Router from "../../protocolLayer/routing/routing.js";
import LoadBalancer from "../../servicesLayer/loadBalancer/loadBalancer.js";
import RateLimiter from "../../servicesLayer/rateLimiter/rateLimiter.js";
import Election from "../../servicesLayer/election/election.js"
import Identity from "../../servicesLayer/identity/identity.js";
import Throttler from "../../servicesLayer/throttler/throttler.js"
import LocalStorage from "../../servicesLayer/localStorage/localStorage.js";

const id = process.argv[2];

//identity service
const identity = new Identity({
    static:true,
    id:id
}).getIdentity()


//defining custom topology
let topology = {
  "A": ["B"],
  "B": ["A", "C", "D"],
  "C": ["B", "E"],
  "D": ["B", "E"],
  "E": ["C", "D", "F"],
  "F": ["E"]
}

//communication adapter
let communication = new Communication({
    identity:identity,
    topic:"DSFDemo",
    allowedNeighbours:new Set(topology[id]) //limiting connections
})

//queuing adapter
let queue = new Queue({
    adapter:communication
})

//routing adapter
let router = new Router({
    identity:identity,
    adapter:queue
})

//p2p load balancer
let loadBalancer = new LoadBalancer({
    identity: identity,
    callback:async(request)=>{
        //simulating a server that takes 10 seconds to process a request
        await delay(10000)
        return { message: "some response" };
    },
    adapter:router
});

//rate limiter
let rateLimiter = new RateLimiter({
    adapter:loadBalancer,
    rate:15 //15 requests per second
})

//throttler
let throttler = new Throttler({
    adapter:loadBalancer,
    rate:15 //15 requests per second
})

//assuming peer A is the gateway/initiator
if(id == "A"){
    setInterval(async()=>{
        //using rateLimiter
        /*
        let response = await rateLimiter.send({
            message:"some request"
        })
        */
        //OR using throttler
        let response = await throttler.send({
            message:"some request"
        })
        console.log("[APP] response",response)

        if(response){
            if(response.status == "FAILURE"){
                console.log("[APP] request was dropped")
            }else{
                console.log("[APP] response", response)
            }
        }else{
            console.log("[APP] request was rate limited and dropped")
        }
    },50) //an interval of 50 seconds results in 20 req/sec
}


//leader/s election
let election = new Election({
    identity:identity,
    adapter:router
})

/*
if(id == "A"){
    setTimeout(async()=>{
        //elects 3 leaders
        let elected = await election.elect(3);
        console.log("initiator sees result ",elected)
    },30000) //we wait for the peers to connect
}
*/

