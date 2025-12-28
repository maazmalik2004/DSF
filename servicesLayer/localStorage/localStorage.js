import fs from "fs"

class LocalStorage{
    constructor(object){
        this.identifier = object.identifier
        this.basePath = "./servicesLayer/localStorage/" + object.identifier
        fs.mkdirSync(this.basePath);
    }

    get(key){
        let value = fs.readFileSync(this.basePath+"/"+key);
        return JSON.parse(value);
    }

    set(key, value){
        fs.writeFileSync(this.basePath+"/"+key, JSON.stringify(value,null,4));
    }
}

export default LocalStorage;