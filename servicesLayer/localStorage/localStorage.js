import fs from "fs"

class LocalStorage{
    constructor(object){
        this.basePath = "./servicesLayer/localStorage/" + object.identifier
        if(!fs.existsSync(this.basePath))fs.mkdirSync(this.basePath);
    }

    get(key){
        let path = this.basePath+"/"+key;
        if(!fs.existsSync(path))return null
        let value = fs.readFileSync(path);
        return JSON.parse(value);
    }

    set(key, value){
        fs.writeFileSync(this.basePath+"/"+key, JSON.stringify(value,null,4));
    }
}

export default LocalStorage;