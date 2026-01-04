import utils from "../../utils/utils.js"
import LocalStorage from "../localStorage/localStorage.js"

class Identity{
    constructor(object){
        this.static = object.static || true
        this.localStorage = new LocalStorage({
            identifier:"IDENTITY-LOCAL-STORAGE"
        })

        this.identity;
        if(object.id){
            this.identity = {
                id:object.id
            }
        }else{
            if(object.static){
                let value = this.localStorage.get("id");
                this.identity = {
                    id:value || utils.getRandomId()
                }
                this.localStorage.set("id",this.identity.id)
            }else{
                this.identity = {
                    id:utils.getRandomId()
                }
            }
        }
    }

    getIdentity(){
        return this.identity;
    }
}

export default Identity