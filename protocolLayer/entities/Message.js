import { ulid } from "ulid";

class Message {
    constructor(message){
        this.message = message

        this.message.id = ulid();
        this.message.timestamp = Date.now();
        this.sender = message.sender;
        this.receiver = message.receiver;
        this.content = message.content;
    }

    serialize(){
        return JSON.stringify(this.message,null,4);
    }

    get(){
        return this.message;
    }

    set(key, value){
        this.message[key] = value;
        this[key] = value
    }
}

export default Message