// import fs from "fs"

// class LocalStorage{
//     constructor(object){
//         this.basePath = "./servicesLayer/localStorage/" + (object.identifier||"DEFAULT")
//         if(!fs.existsSync(this.basePath))fs.mkdirSync(this.basePath);
//     }

//     get(key){
//         let path = this.basePath+"/"+key;
//         if(!fs.existsSync(path))return null
//         let value = fs.readFileSync(path);
//         return JSON.parse(value);
//     }

//     set(key, value){
//         fs.writeFileSync(this.basePath+"/"+key, JSON.stringify(value,null,4));
//     }
// }

// export default LocalStorage;

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LocalStorage {
    constructor(object = {}) {
        this.basePath = path.join(
            __dirname,
            "servicesLayer",
            "localStorage",
            object.identifier || "DEFAULT"
        );

        fs.mkdirSync(this.basePath, { recursive: true });
    }

    get(key) {
        const filePath = path.join(this.basePath, key);
        if (!fs.existsSync(filePath)) return null;

        const value = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(value);
    }

    set(key, value) {
        const filePath = path.join(this.basePath, key);
        fs.writeFileSync(filePath, JSON.stringify(value, null, 4));
    }
}

export default LocalStorage;
