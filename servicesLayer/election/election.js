import Router from "../../protocolLayer/routing/routing.js";
import Queue from "../../messagingLayer/queuing/queuingAdapters/byassQueue.js";
import Communication from "../../messagingLayer/communication/communicationAdapters/hyperswarm.js";
import { ulid } from "ulid";
import { EventEmitter } from "node:events";

class Election {
    constructor(object) {
        this.emitter = new EventEmitter();
        this.identity = object.identity;
        this.deadline = object.deadline || 5000;
        this.connectedPeers = new Set();
        this.electionContexts = new Map();
        this.encounteredElections = new Set();
        this.encounteredAnnouncements = new Set();

        const communication = new Communication({
            topic: "myTopic",
            identity: object.identity
        });

        const queue = new Queue({
            communicationAdapter: communication
        });

        this.router = new Router({
            identity: object.identity,
            messagingAdapter: queue
        });

        this.router.on("connected", (identity) => {
            this.connectedPeers.add(identity.id);
        });

        this.router.on("disconnected", (identity) => {
            this.connectedPeers.delete(identity.id);
        });

        this.router.on("received", (message) => {

            if (message.payload.label == "ELECTION") {
                
                if (this.encounteredElections.has(message.payload.electionId)) return;
                this.encounteredElections.add(message.payload.electionId);

                for (const peer of this.connectedPeers) {
                    if (peer == message.sender) continue;
                    message.receiver = peer;
                    this.router.send(message);
                }

                const electionAckMessage = {
                    receiver: message.payload.initiator,
                    payload: {
                        label: "ELECTION-ACK",
                        electionId:message.payload.electionId,
                        candidate: this.identity.id,
                        randomDraw: Math.random()
                    }
                };
                this.router.send(electionAckMessage);
            }

            else if (message.payload.label == "ELECTION-ACK") {
                const electionId = message.payload.electionId
                const context = this.electionContexts.get(electionId);
                context.electionAcks.add({
                    candidate: message.payload.candidate,
                    randomDraw: message.payload.randomDraw
                });
                this.electionContexts.set(electionId, context);
            }

            else if (message.payload.label == "ELECTION-CROWN") {
                console.log("[ELECTION] received crown", message)
                const electionId = message.payload.electionId;
                this.emitter.emit("crowned", { electionId });
                const crownAckMessage = {
                    receiver: message.payload.initiator,
                    payload: {
                        label: "ELECTION-CROWN-ACK",
                        electionId:electionId,
                        candidate: this.identity.id
                    }
                };
                console.log("[ELECTION] sending crown acknowledgement", crownAckMessage)
                this.router.send(crownAckMessage);
            }

            else if (message.payload.label === "ELECTION-CROWN-ACK") {
                console.log("[ELECTION] received crown acknowledgement ",message)
                const electionId = message.payload.electionId;
                const context = this.electionContexts.get(electionId);

                context.electionCrownAcks.add(message.payload.candidate);

                // When all elected candidates have acknowledged, announce result
                if (context.electionCrownAcks.size === context.elected.size) {
                    const announcementId = ulid();
                    this.encounteredAnnouncements.add(announcementId);

                    const announceMessage = {
                        payload: {
                            label: "ELECTION-ANNOUNCE",
                            electionId,
                            announcementId,
                            elected: Array.from(context.elected)
                        }
                    };

                    for (const peer of this.connectedPeers) {
                        announceMessage.receiver = peer
                        this.router.send(announceMessage);
                    }

                    // Resolve initiator's promise
                    context.electionPromise.resolve({
                        electionId,
                        elected: Array.from(context.elected)
                    });

                    // this.electionContexts.delete(electionId);
                }

                this.electionContexts.set(electionId, context);
            }

            else if (message.payload.label === "ELECTION-ANNOUNCE") {
                if (this.encounteredAnnouncements.has(message.payload.announcementId)) return;
                this.encounteredAnnouncements.add(message.payload.announcementId);

                this.emitter.emit("elected", {
                    electionId: message.payload.electionId,
                    elected:message.payload.elected
                });

                for (const peer of this.connectedPeers) {
                    if (peer === message.sender) continue;
                    message.receiver = peer
                    this.router.send(message);
                }
            }
        });

        this.router.on("dropped",message=>{
            console.log("[ELECTION] dropped message ", message)
        })
    }

    getDeferredPromise() {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    }

    elect(k = 1, options = {}) {
        let include = options.include || null;
        let exclude = new Set(options.exclude || []);

        const electionId = ulid();
        this.encounteredElections.add(electionId);

        const { promise, resolve, reject } = this.getDeferredPromise();

        this.electionContexts.set(electionId, {
            electionAcks: new Set(),
            elected: new Set(),
            electionCrownAcks: new Set(),
            electionPromise: { resolve, reject }
        });

        const electionMessage = {
            payload: {
                label: "ELECTION",
                electionId:electionId,
                initiator: this.identity.id
            }
        };

        for (const peer of this.connectedPeers) {
            electionMessage.receiver = peer;
            this.router.send(electionMessage);
        }

        // After deadline, select top k candidates with inclusion/exclusion rules
        setTimeout(() => {
            const context = this.electionContexts.get(electionId);

            let potentialCandidates = Array.from(context.electionAcks);
            console.log("[ELECTION] potential candidates ", potentialCandidates)

            //exclude
            if (exclude.size > 0) {
                potentialCandidates = potentialCandidates.filter(
                    item => !exclude.has(item.candidate)
                );
            }

            //include
            if (include !== null) {
                include = new Set(include);
                potentialCandidates = potentialCandidates.filter(
                    item => include.has(item.candidate)
                );
            }

            const elected = potentialCandidates
                .sort((a, b) => b.randomDraw - a.randomDraw)
                .slice(0, k)
                .map(item=>item.candidate);

            console.log("[ELECTION] after filtering ",elected)

            context.elected = new Set(elected);
            this.electionContexts.set(electionId, context);

            let electionCrownMessage = {
                payload: {
                    label: "ELECTION-CROWN",
                    electionId:electionId,
                    initiator: this.identity.id
                }
            };

            for (const candidate of elected) {
                electionCrownMessage.receiver = candidate;
                console.log("[ELECTION] sending crown message", electionCrownMessage)
                this.router.send(electionCrownMessage);
            }
        }, this.deadline);

        return promise;
    }

    on(event, callback) {
        this.emitter.on(event, callback);
    }
}

export default Election;