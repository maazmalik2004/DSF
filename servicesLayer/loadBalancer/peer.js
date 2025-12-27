import App from "./loadBalancer.js";

const id = process.argv[2];

let loadBalancer = new App({
    identity: {
        id:id
    }
});

if(id == "A"){
    setTimeout(()=>{
     setInterval(()=>{
        loadBalancer.serve({meow:"some request"})
    },100)
},0)
}