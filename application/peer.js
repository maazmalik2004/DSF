import App from "./app.js";

const id = process.argv[2];

let loadBalancer = new App({
    identity: {
        id:id
    }
});

if(id == "A"){
    setInterval(()=>{
        loadBalancer.serve("some request")
    },10000)
}