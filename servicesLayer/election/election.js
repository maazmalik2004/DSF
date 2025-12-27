import Router from "../../protocolLayer/routing/routing.js"
import Queue from "../../messagingLayer/queuing/queuingAdapters/byassQueue.js"
import Communication from "../../messagingLayer/communication/communicationAdapters/hyperswarm.js"
import {ulid} from "ulid";

class Election {
    constructor(object){
        this.identity = object.identity
        this.connectedPeers = new Set();
        this.electionContexts = new Map();
        this.encounteredElections = new Set();
        
        let communication = new Communication({
            topic: "myTopic",
            identity: object.identity
        });

        let queue = new Queue({
            communicationAdapter: communication
        });

        this.router = new Router({
            identity: object.identity,
            messagingAdapter: queue
        });

        this.router.on("connected",identity=>{
            this.connectedPeers.add(identity.id)
        })

        this.router.on("disconnected",identity=>{
            this.connectedPeers.delete(identity.id)
        })

        this.router.on("received",message=>{
            if(message.payload.label == "ELECTION"){
                if(this.encounteredElections.has(message.payload.electionId)){
                    //ELECTION-ACK sequence
                    let electionAckMessage = {
                        receiver:message.payload.initiator,
                        payload:{
                            label:"ELECTION-ACK",
                            electionId:message.payload.electionId,
                            candidate:this.identity.id,
                            randomDraw:Math.random()
                        }
                    }
                    this.router.send(electionAckMessage)
                }

                this.encounteredElections.add(message.payload.electionId);

                for(let peer of this.connectedPeers){
                    if(peer == message.sender)continue;

                    message.receiver = peer;
                    this.router.send(message);
                }
            }
            if(message.payload.label == "ELECTION-ACK"){

            }
        })
    }

    getDefferedPromise(){
        let resolve = null;
        let reject = null;

        let promise = new Promise((res, rej)=>{
            resolve = res;
            reject = rej;
        });

        return {
            promise,
            resolve,
            reject
        }
    }

    elect(k){
        let electionId = ulid();
        this.encounteredElections.add(electionId)
        this.electionContexts.set(electionId,{
            electionAck:new Set(),
            elected:new Set(),
            electionAnnounceAck: new Set()
        });
        let electionPromise = this.getDefferedPromise();
        setTimeout(()=>{
            
        },10000)
        let electionMessage = {
            payload:{
                label:"ELECTION",
                electionId:electionId,
                initiator:this.identity.id
            }
        }
        for(let peer of this.connectedPeers){
            electionMessage.receiver = peer;
            this.router.send(electionMessage);
        }

        return electionPromise.promise;
    }
}