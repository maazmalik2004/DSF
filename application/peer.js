import App from "./app.js";

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
    },500)
},0)
}