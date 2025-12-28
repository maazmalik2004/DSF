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
        this.identity = object.identity

        this.connectedPeers = new Map();
        this.unresolvedRequests = new Map();
        this.requestIdPromiseMapping = new Map();

        this.currentLoad = 0;

        this.adapter = object.adapter

        this.adapter.on("connected", identity => {
            this.connectedPeers.set(identity.id, identity);
        })

        this.adapter.on("disconnected", identity => {
            this.connectedPeers.delete(identity.id);
        })

        this.adapter.on("received", message => {
            if (message.payload.label == "REQUEST") {
                // if(message.payload.token && message.payload.token == this.identity.id){
                //     //it has already accepted and must process the request
                //     this.currentLoad = this.currentLoad + 1;
                //     setTimeout(() => {
                //         let responseMessage = {
                //             receiver: message.payload.hitAt,
                //             payload: {
                //                 requestId: message.payload.requestId,
                //                 label: "RESPONSE",
                //                 token: this.identity.id,
                //                 response: "some response"
                //             }
                //         }
                //         this.currentLoad = this.currentLoad - 1;
                //         // this.adapter.relay(responseMessage);
                //     }, 10000)
                //     return;
                // }

                let canAccept = this.canAccept();
                let peers = [...this.connectedPeers.keys()].filter(peer => peer !== message.sender);

                if (canAccept) {
                    visualizer.reportAccepted(this.identity.id)
                    console.log("[APP] accepted request ", message)
                    this.currentLoad = this.currentLoad + 1;
                    setTimeout(() => {
                        console.log("[APP] initiating response")
                        let responseMessage = {
                            id: message.id,
                            receiver: message.payload.hitAt,
                            payload: {
                                label: "RESPONSE",
                                token: this.identity.id,
                                response: "some response"
                            }
                        }
                        this.currentLoad = this.currentLoad - 1;
                        visualizer.reportCompleted(this.identity.id)
                        console.log("[APP] initiating response message", responseMessage)
                        this.adapter.relay(responseMessage);
                    }, 1000)
                    return;
                }

                //if we have reached a deadend, we are allowed to send it to our sender as well
                if (peers.length == 0) {
                    console.log("[APP] reached deadend, sending back", message)
                    peers.push(message.sender);
                }

                console.log("[APP] forwarding request ", message)
                const chosenNeighbour = peers[Math.floor(Math.random() * peers.length)];
                message.receiver = chosenNeighbour;
                this.adapter.relay(message);
            }

            if (message.payload.label == "RESPONSE") {
                //response will be relayed directly to hitAt
                visualizer.log(message.id, "response")
                this.unresolvedRequests.delete(message.id);
                this.requestIdPromiseMapping.get(message.payload.requestId).resolve(message.payload.response)
                console.log("[APP] response ", message)
            }
        })

        this.adapter.on("dropped", message => {
            visualizer.log(message.id, "dropped")
            this.requestIdPromiseMapping.get(message.payload.requestId).reject("request was dropped")
            console.log("[APP] dropped message ", message)
        })
    }

    canAccept() {
        const loadFactor = 1 / (1 + this.currentLoad);
        const degreeFactor = 1 / (1 + this.connectedPeers.size)
        const factorOfAcceptance = 0.9 * loadFactor + 0.1 * degreeFactor;
        console.log(factorOfAcceptance)

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

    send(request) {
        this.serve(request);
    }

    serve(request) {
        //we can accept it too but lets leave that out for now
        let requestId = ulid();
        let requestPromise = this.getDeferredPromise();
        this.requestIdPromiseMapping.set(requestId, requestPromise)

        let message = {
            id: requestId,
            payload: {
                label: "REQUEST",
                hitAt: this.identity.id,
                request: {
                    ...request
                }
            }
        }

        console.log("[APP] sending request ", message)

        // if(this.canAccept() || this.connectedPeers.size == 0){
        //     console.log("[APP] accepted request in A ",message)
        //     visualizer.reportAccepted(this.identity.id)
        //     this.currentLoad = this.currentLoad + 1;
        //     setTimeout(() => {
        //         this.currentLoad = this.currentLoad - 1;
        //         visualizer.reportCompleted(this.identity.id)
        //     },10000)
        //     return;
        // };

        //case 1, request has no token (a token will be assigned), we wil do a random walk
        if (!request.token) {
            //initiate random walk
            const peerIds = [...this.connectedPeers.keys()];
            const chosenNeighbour = peerIds[Math.floor(Math.random() * peerIds.length)];
            if (!chosenNeighbour) {
                // visualizer.log(requestId,"request")
                // //if there is no neighbour accept the request yourself
                // console.log("[APP] accepted request myself since no neighbours found ",message)
                // visualizer.reportAccepted(this.identity.id)
                // this.currentLoad = this.currentLoad + 1;
                // setTimeout(() => {
                //     console.log("[APP] initiating response")
                //     let responseMessage = {
                //         id:message.id,
                //         receiver: message.payload.hitAt,
                //         payload: {
                //             label: "RESPONSE",
                //             token: this.identity.id,
                //             response: "some response"
                //         }
                //     }
                //     this.currentLoad = this.currentLoad - 1;
                //     visualizer.reportCompleted(this.identity.id)
                //     console.log("[APP] initiating response message from self acceptance", responseMessage)
                //     this.adapter.relay(responseMessage);
                // },50);
                return requestPromise.promise
            }
            message.receiver = chosenNeighbour;
            visualizer.log(requestId, "request")
            this.adapter.relay(message);
            this.unresolvedRequests.set(requestId, message);
            return requestPromise.promise;
        }

        //case 2, request has a token
        message.payload.token = request.token
        message.receiver = request.token;
        visualizer.log(requestId, "request")
        this.adapter.relay(message);
        this.unresolvedRequests.set(requestId, message);
        return requestPromise.promise;
    }
}

export default LoadBalancer;