import {EventEmitter} from "node:events";
import utils from "../../utils/utils.js"

class LoadBalancer {
    constructor(object) {
        this.identity = object.identity;
        this.adapter = object.adapter;
        this.callback = object.callback;

        this.emitter = new EventEmitter();
        this.connectedPeers = new Set();
        this.requestIdDeferredPromiseMapping = new Map();
        this.currentLoad = 0;

        this.adapter.on("connected", identity => {
            console.log("[LOAD BALANCER] connected ", identity.id)
            this.connectedPeers.add(identity.id);
        })

        this.adapter.on("disconnected", identity => {
            console.log("[LOAD BALANCER] disconnected ", identity.id)
            this.connectedPeers.delete(identity.id);
        })

        this.adapter.on("received", async(message) => {
            message = {
                ...message.applicationMessage,
                source:message.source,
                target:message.target,
                sender:message.sender,
                receiver:message.receiver
            }
            console.log("[LOAD-BALANCER] transformed message")
            
            if (message.payload.label == "REQUEST") {
                if (this.canAccept() || message.payload.token == this.identity.id) {
                    console.log("[LOAD-BALANCER] received request -> accepted request ", message)
                    this.currentLoad = this.currentLoad + 1;
                    let response = await this.callback(message.payload.request);
                    this.currentLoad = this.currentLoad - 1;
                    
                    let responseMessage = {
                        target: message.payload.hitAt,
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

                let peers = [...this.connectedPeers].filter(peer => peer !== message.source);
                if (peers.length == 0) {
                    console.log("[APP] reached deadend, allowing sending back", message)
                    peers.push(message.source);
                }

                const chosenNeighbour = peers[Math.floor(Math.random() * peers.length)];
                message.target = chosenNeighbour;
                console.log("[APP] forwarding request ", message)
                this.adapter.relay(message);
            }

            if (message.payload.label == "RESPONSE") {
                let requestPromise = this.requestIdDeferredPromiseMapping.get(message.payload.requestId);
                if(!requestPromise)return;
                requestPromise.resolve(message.payload.response)
                this.requestIdDeferredPromiseMapping.delete(message.payload.requestId)
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
            }
        })

        this.adapter.on("dropped", message => {
            message = {
                ...message.applicationMessage,
                source:message.source,
                target:message.target,
                sender:message.sender,
                receiver:message.receiver
            }
            console.log("[LOAD-BALANCER] transformed message", message)
            if(message.payload.label == "REQUEST"){
                let failureMessage = {
                    target:message.payload.hitAt,
                    payload:{
                        label:"FAILURE",
                        requestId:message.payload.requestId
                    }
                }
                this.adapter.send(failureMessage);
            }
            if(message.payload.label == "RESPONSE"){
                let failureMessage = {
                    target:message.target,
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
        const loadFactor = 1 / Math.pow(1 + this.currentLoad, 6);
        const degreeFactor = 1 / (1 + this.connectedPeers.size)
        const factorOfAcceptance = 0.95 * loadFactor + 0.05 * degreeFactor;
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
       
        // case 1, request has a token
        if (request.token) {
            message.payload.token = request.token
            message.target = request.token;
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
                target: message.payload.hitAt,
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
        message.target = chosenNeighbour;
        this.adapter.relay(message);
        return requestPromise.promise;
    }
}

export default LoadBalancer;