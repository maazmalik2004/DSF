// mockCommunicationAdapter.js
import { EventEmitter } from "node:events";

class MockCommunicationAdapter {
  constructor() {
    // This is the same pattern you use in EventQueue
    this.emitter = new EventEmitter();

    this.connected = false;
    this.identity = null;
    this.sentMessages = [];
  }

  // Called by EventQueue → triggers "outgoingQueued" → ends up here
  send(message) {
    if (!this.connected) {
      throw new Error("Cannot send: not connected");
    }

    this.sentMessages.push(message);
    // Real adapter emits "sent" when the message actually leaves
    this.emitter.emit("sent", message);
  }

  // Test helper – pretend the network just delivered a message
  simulateIncoming(message) {
    this.emitter.emit("received", message);
  }

  // Test helpers for connection lifecycle
  simulateConnect(identity = "peer-123") {
    this.connected = true;
    this.identity = identity;
    this.emitter.emit("connected", identity);
  }

  simulateDisconnect(identity = null) {
    this.connected = false;
    const prevIdentity = this.identity;
    this.identity = null;
    this.emitter.emit("disconnected", identity ?? prevIdentity);
  }

  // Standard EventEmitter methods – forward to this.emitter
  on(eventName, callback) {
    this.emitter.on(eventName, callback);
  }

  off(eventName, callback) {
    this.emitter.off(eventName, callback);
  }

  removeAllListeners(eventName) {
    this.emitter.removeAllListeners(eventName);
  }

  // Optional reset for clean test runs
  reset() {
    this.emitter.removeAllListeners();
    this.connected = false;
    this.identity = null;
    this.sentMessages = [];
  }
}

export default MockCommunicationAdapter;