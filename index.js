import messaging from "./messagingLayer/messaging.js";

// messaging.messagingEvents.on("toBeSent",(event)=>{
//   console.log(JSON.stringify(event,null,4))
// })

// messaging.messagingEvents.on("sent",(event)=>{
//   console.log(JSON.stringify(event,null,4))
// })

// messaging.messagingEvents.on("delivered",(event)=>{
//   console.log(JSON.stringify(event,null,4))
// })

// messaging.messagingEvents.on("toBeRetried",(event)=>{
//   console.log(JSON.stringify(event,null,4))
// })

// messaging.messagingEvents.on("retried",(event)=>{
//   console.log(JSON.stringify(event,null,4))
// })

// messaging.messagingEvents.on("failed",(event)=>{
//   console.log(JSON.stringify(event,null,4))
// })

// messaging.messagingEvents.on("toBeDropped",(event)=>{
//   console.log(JSON.stringify(event,null,4))
// })

// messaging.messagingEvents.on("dropped",(event)=>{
//   console.log(JSON.stringify(event,null,4))
// })

// messaging.messagingEvents.on("drained",(event)=>{
//   console.log(JSON.stringify(event,null,4))
// })

messaging.messagingEvents.on("received",(event)=>{
  console.log(JSON.stringify(event,null,4))
})

for (let i = 1; i <= 5; i++) {

  messaging.send(`message ${i}`);

}

for (let i = 1; i <= 5; i++) {

  await messaging.sendAsync(`async message ${i}`);

}

//testing mongodb storage interface

// import LocalStorage from "./localStorageLayer/localStorage.js";
// import MongoDB from "./localStorageLayer/storageInterfaces/mongoDb.js";
// import LMDB from "./localStorageLayer/storageInterfaces/lmdb.js";

// // let storageInterface = new MongoDB({
// //   uri:"mongodb://localhost:27017/",
// //   dbName:"dsf",
// //   collectionName:"localStorage"
// // });

// let storageInterface = new LMDB({
//   storagePath : "./localStorageLayer/lmdbLocalStorage"
// });

// let localStorage = new LocalStorage({
//   interface: storageInterface
// });

// await localStorage.set("key",{
//   value:"value"
// });

// console.log(await localStorage.get("key"));

// await localStorage.remove("key")
