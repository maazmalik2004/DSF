
import Communication from "../../messagingLayer/communication/communicationAdapters/hyperswarm.js"
import Queue from "../../messagingLayer/queuing/queuingAdapters/byassQueue.js"
import Router from "../../protocolLayer/routing/routing.js"
import LoadBalancer from "./loadBalancer.js";

const id = process.argv[2];

let router = new Router({
        identity:{
            id:id
        },
        adapter:new Queue({
            adapter:new Communication({
                identity:{
                    id:id
                },
                topic:"DSF",
            })
        })
    })

let loadBalancer = new LoadBalancer({
    identity: {
        id:id
    },
    callback:async(request)=>{
        await new Promise(resolve => setTimeout(resolve, 6000));
        return { message: "some response" };
    },
    adapter:router,
    name:"myRouter"
});

let counts = {
    totalCount: 0,
    successCount : 0
}

if(id == "A"){
    setTimeout(()=>{
     setInterval(async ()=>{
        counts.totalCount++;
        let response = await loadBalancer.send({
            meow:"some request",
        })
    
        console.log("[PEER] response ", response)
        if(response.status != "FAILURE"){
            counts.successCount++;
        }else{
            console.log("ULULU")
        }
        console.log("[APP] counts",counts)
    },3000)
},0)
}