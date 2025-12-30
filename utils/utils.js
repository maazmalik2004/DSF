import { ulid } from "ulid";

function getRandomId(){
    return ulid();
}

export default {
    getRandomId
}