class Cache{
    constructor(object){
        this.adapter = object.adapter;
        this.parameter = "id"
        this.cache = new Map();
    }

    async send(request){
        let response = await this.adapter.send(request);

        
    }
}

export default Cache;