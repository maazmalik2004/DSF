import {EventEmitter} from "node:events";
import utils from "../../utils/utils.js"
import client from "./client.js"

class LoadBalancer {
    constructor(object) {
        this.identity = object.identity;
        this.adapter = object.adapter;
        this.callback = object.callback;

        this.emitter = new EventEmitter();
        this.connectedPeers = new Set();
        this.requestIdDeferredPromiseMapping = new Map();
        this.currentLoad = 0;
        this.componentId = "LoadBalancer" + "-" + utils.getRandomId();

        this.adapter.on("connected", identity => {
            console.log("[LOAD BALANCER] connected ", identity.id)
            this.connectedPeers.add(identity.id);
        })

        this.adapter.on("disconnected", identity => {
            console.log("[LOAD BALANCER] disconnected ", identity.id)
            this.connectedPeers.delete(identity.id);
        })

        this.adapter.on("received", async(message) => {
            
            if (message.payload.label == "REQUEST") {
                if (this.canAccept() || message.payload.token == this.identity.id) {
                    console.log("[LOAD-BALANCER] received request -> accepted request ", message)
                    this.currentLoad = this.currentLoad + 1;
                    let response = await this.callback(message.payload.request);
                    this.currentLoad = this.currentLoad - 1;
                    
                    let responseMessage = {
                        receiver: message.payload.hitAt,
                        payload: {
                            label: "RESPONSE",
                            requestId:message.payload.requestId,
                            token: this.identity.id,
                            response: response
                        }
                    }
                    console.log("[LOAD-BALANCER] initiating response ", responseMessage)
                    this.adapter.relay(responseMessage);
                    return;
                }

                let peers = [...this.connectedPeers].filter(peer => peer !== message.sender);
                if (peers.length == 0) {
                    console.log("[APP] reached deadend, allowing sending back", message)
                    peers.push(message.sender);
                }

                console.log("[APP] forwarding request ", message)
                const chosenNeighbour = peers[Math.floor(Math.random() * peers.length)];
                message.receiver = chosenNeighbour;
                this.adapter.relay(message);
            }

            if (message.payload.label == "RESPONSE") {
                let requestPromise = this.requestIdDeferredPromiseMapping.get(message.payload.requestId);
                if(!requestPromise)return;
                requestPromise.resolve(message.payload.response)
                this.requestIdDeferredPromiseMapping.delete(message.payload.requestId)
                client.log({
                    componentId:this.componentId,
                    messageId:message.payload.requestId,
                    eventName:"response",
                    eventValue:"true"
                })
                console.log("[APP] response ", message)
            }

            if(message.payload.label == "FAILURE"){
                console.log("[LOAD-BALANCER] received FAILURE message ",message)
                let requestPromise = this.requestIdDeferredPromiseMapping.get(message.payload.requestId);
                if(!requestPromise)return;
                requestPromise.resolve({
                    status:"FAILURE",
                    requestId:message.payload.requestId
                })
                this.requestIdDeferredPromiseMapping.delete(message.payload.requestId)
                client.log({
                    componentId:this.componentId,
                    messageId:message.payload.requestId,
                    eventName:"failure",
                    eventValue:"true"
                })
            }
        })

        this.adapter.on("dropped", message => {
            console.log("[LOAD BALANCER] dropped ",message)
            if(message.payload.label == "REQUEST"){
                let failureMessage = {
                    receiver:message.payload.hitAt,
                    payload:{
                        label:"FAILURE",
                        requestId:message.payload.requestId
                    }
                }
                this.adapter.send(failureMessage);
            }
            if(message.payload.label == "RESPONSE"){
                let failureMessage = {
                    receiver:message.target,
                    payload:{
                        label:"FAILURE",
                        requestId:message.payload.requestId
                    }
                }
                this.adapter.send(failureMessage);
            }
        })
    }

    canAccept() {
        const loadFactor = 1 / (1 + this.currentLoad);
        const degreeFactor = 1 / (1 + this.connectedPeers.size)
        const factorOfAcceptance = 0.9 * loadFactor + 0.1 * degreeFactor;
        return Math.random() <= factorOfAcceptance
    }

    getDeferredPromise() {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return {
            promise,
            resolve,
            reject
        };
    }

    async send(request) {
        let requestId = utils.getRandomId();
        let requestPromise = this.getDeferredPromise();
        this.requestIdDeferredPromiseMapping.set(requestId, requestPromise)

        let message = {
            payload: {
                label: "REQUEST",
                requestId:requestId,
                hitAt: this.identity.id,
                request: request
            }
        }

        console.log("[LOAD-BALANCER] sending request... ", message)
        client.log({
            componentId:this.componentId,
            messageId:requestId,
            eventName:"request",
            eventValue:"true"
        })

        // case 1, request has a token
        if (request.token) {
            message.payload.token = request.token
            message.receiver = request.token;
            this.adapter.relay(message);
            return requestPromise.promise;
        }

        //case 2, request has no token
        if(this.canAccept() || this.connectedPeers.size == 0){
            console.log("[LOAD-BALANCER] accepted request myself", message)
            this.currentLoad = this.currentLoad + 1;
            let response = await this.callback(message.payload.request);
            this.currentLoad = this.currentLoad - 1;
            
            let responseMessage = {
                receiver: message.payload.hitAt,
                payload: {
                    requestId:message.payload.requestId,
                    label: "RESPONSE",
                    token: this.identity.id,
                    response: response
                }
            }
            console.log("[LOAD-BALANCER] initiating response ", responseMessage)
            this.adapter.relay(responseMessage);
            return requestPromise.promise
        };

        //initiate random walk
        const peerIds = [...this.connectedPeers];
        const chosenNeighbour = peerIds[Math.floor(Math.random() * peerIds.length)];
        message.receiver = chosenNeighbour;
        this.adapter.relay(message);
        return requestPromise.promise;
    }
}

export default LoadBalancer;