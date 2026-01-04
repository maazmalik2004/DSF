# Distributed Systems Framework 
A framework for building intuitive distributed applications as if it were a regular application.

<img width="1417" height="253" alt="DSF (2)" src="https://github.com/user-attachments/assets/972c3a7e-6e12-4a7c-bbd1-e3d7a0d957bf" />

## Creating a Distributed Application- ApplicationLayer/myApp/peer.js
### Building Your Stack

#### 1) Identity Service- Provides a unique identity to a peer
```JS
import Identity from "../../servicesLayer/identity/identity.js";

const identity = new Identity({
    static:true, //same identity on restart, false- new identity each time,
    id:"A" //you can override id
}).getIdentity()
```

#### 2) Communication Stack- For communicating between peers via messages
```JS
import Communication from "../../messagingLayer/communication/hyperswarm/hyperswarm.js";
import Queue from "../../messagingLayer/queuing/bypassQueue/bypassQueue.js";
import Router from "../../protocolLayer/routing/routing.js";

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
    topic:"yourUniqueId",
    allowedNeighbours:new Set(topology["A"]) //optional
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
```

#### 3) Leader Election- electing k leaders
```JS
import Election from "../../servicesLayer/election/election.js"

let election = new Election({
    identity:identity,
    adapter:router
})

//electing 3 leaders
setTimeout(async()=>{
  let elected = await election.elect(3);
  console.log("[APP] initiator sees result ",elected)
},30000) //we wait for the peers to connect
```

#### 4) Load Balancer- Peer to peer load balancing
```JS
import LoadBalancer from "../../servicesLayer/loadBalancer/loadBalancer.js";

let loadBalancer = new LoadBalancer({
    identity: identity,
    callback:async(request)=>{
        //simulating a server that takes 10 seconds to process a request
        return new Promise((res, rej)=>{
            setTimeout(()=>{
                res({message:"some response"})
            },10000)
        })
    },
    adapter:router
});

setInterval(async()=>{
        let response = await loadBalancer.send({
            message:"some request"
        })
        console.log("[APP] response",response)

        if(response.status == "FAILURE"){
            console.log("[APP] request was dropped")
        }else{
            console.log("[APP] response", response)
        }
        
    },50) 
```

#### 5) RateLimiter- drops excess messages
```JS
import RateLimiter from "../../servicesLayer/rateLimiter/rateLimiter.js";

let rateLimiter = new RateLimiter({
    adapter:loadBalancer,
    rate:15 //allow 15 requests per second
})

setInterval(async()=>{
        let response = await rateLimiter.send({
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
    },50) //an interval of 50 milliseconds results in 20 req/sec
```

#### 6) Throttler- queues excess messages
```JS
import Throttler from "../../servicesLayer/throttler/throttler.js"

let throttler = new Throttler({
    adapter:loadBalancer,
    rate:15 //allows 15 requests per second
})

setInterval(async()=>{
        let response = await throttler.send({
            message:"some request"
        })
        console.log("[APP] response",response)

        if(response.status == "FAILURE"){
            console.log("[APP] request was dropped")
        }else{
            console.log("[APP] response", response)
        }
    },50) //an interval of 50 milliseconds results in 20 req/sec
```

#### 7) Local Storage- A key-value storage
```JS
import LocalStorage from "../../servicesLayer/localStorage/localStorage.js";

const localStorage = new LocalStorage({
    identifier: "USERS" // define scope/context
});

localStorage.set("alice", {
    name: "Alice Wonderland",
    age: 28,
    email: "alice@example.com",
    role: "admin",
    registered: true
});

console.log(localStorage.get("alice"));
```

### Upcoming Services
1) local compute
2) distributed storage
3) distributed compute
4) cache
5) firewall
6) container orchestration
