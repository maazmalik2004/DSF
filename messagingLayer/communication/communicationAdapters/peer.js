
import Communication from "./hyperswarm.js"

const id = process.argv[2];

new Communication({
            identity:{
                id:id
            },
            topic:"someetopic"
        })