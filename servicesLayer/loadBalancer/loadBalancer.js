import {
    EventEmitter
} from "node:events";
import {
    ulid
} from "ulid";

import visualizer from "./utils.js";

class LoadBalancer {
    constructor(object) {
        this.emitter = new EventEmitter();
        this.identity = object.identity;
        this.adapter = object.adapter;
        this.callback = object.callback;

        this.connectedPeers = new Map();

        this.requestIdPromiseMapping = new Map();

        this.currentLoad = 0;

        this.adapter.on("connected", identity => {
            this.connectedPeers.set(identity.id, identity);
        })

        this.adapter.on("disconnected", identity => {
            this.connectedPeers.delete(identity.id);
        })

        this.adapter.on("received", async(message) => {
            
            if (message.payload.label == "REQUEST") {
                
                let canAccept = this.canAccept();
                if (canAccept) {
                    console.log("[LOAD-BALANCER] accepted request ", message)
                    this.currentLoad = this.currentLoad + 1;
                    let response = await this.callback(message.payload.request);
                    this.currentLoad = this.currentLoad - 1;
                    
                    let responseMessage = {
                        id: message.id,
                        receiver: message.payload.hitAt,
                        payload: {
                            label: "RESPONSE",
                            token: this.identity.id,
                            response: response
                        }
                    }
                    console.log("[LOAD-BALANCER] initiating response ", responseMessage)
                    this.adapter.relay(responseMessage);
                    return requestPromise.promise;
                }

                let peers = [...this.connectedPeers.keys()].filter(peer => peer !== message.sender);
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
                this.requestIdPromiseMapping.get(message.payload.requestId).resolve(message.payload.response)
                console.log("[APP] response ", message)
            }
        })

        this.adapter.on("dropped", message => {
            this.requestIdPromiseMapping.get(message.payload.requestId).reject("request was dropped")
            console.log("[APP] dropped request ", message)
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
        let requestId = ulid();
        let requestPromise = this.getDeferredPromise();
        this.requestIdPromiseMapping.set(requestId, requestPromise)

        let message = {
            id: requestId,
            payload: {
                label: "REQUEST",
                hitAt: this.identity.id,
                request: request
            }
        }

        console.log("[LOAD-BALANCER] sending request ", message)

        //case 1, request has no token (a token will be assigned), we wil do a random walk
        if (!request.token) {
            if(this.canAccept() || this.connectedPeers.size == 0){
                console.log("[LOAD-BALANCER] accepted request myself", message)
                this.currentLoad = this.currentLoad + 1;
                let response = await this.callback(message.payload.request);
                this.currentLoad = this.currentLoad - 1;
                
                let responseMessage = {
                    id: message.id,
                    receiver: message.payload.hitAt,
                    payload: {
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
            const peerIds = [...this.connectedPeers.keys()];
            const chosenNeighbour = peerIds[Math.floor(Math.random() * peerIds.length)];
            message.receiver = chosenNeighbour;
            visualizer.log(requestId, "request")
            this.adapter.relay(message);
            return requestPromise.promise;
        }

        //case 2, request has a token
        message.payload.token = request.token
        message.receiver = request.token;
        this.adapter.relay(message);
        return requestPromise.promise;
    }
}

export default LoadBalancer;