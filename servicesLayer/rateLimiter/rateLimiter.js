class RateLimiter {
    constructor(object) {
        this.adapter = object.adapter
        this.tokens = object.capacity || object.rate * 2
        this.rate = object.rate
        this.capacity = object.capacity || object.rate * 2
        setInterval(() => {
            //we refill tokens every second
            this.tokens = Math.min(this.tokens + this.rate, this.capacity);
        }, 1000);
    }

    send(message) {
        if (this.tokens == 0) {
            // console.log("dropping")
            return false;
        }

        // console.log("serving")
        this.tokens = this.tokens - 1;
        return true;
    }
}

export default RateLimiter

// // let rl = new RateLimiter({
// //     rate:20
// // })

// // let rate = 30;
// // let served = 0;
// // let dropped = 0;

// // setInterval(()=>{
// //     let truth = rl.send("some message")
// //     truth? ++served : ++dropped;
// //     console.log("serve rate",served/(served+dropped));
// // },1000/rate)

// // Configuration
// import asciichart from "asciichart";
// const rl = new RateLimiter({
//     rate: 20
// });
// const attemptRate = 10000; // requests per second we're trying to send

// let served = 0;
// let dropped = 0;
// let totalRequests = 0;

// // Store serve rate history for plotting (one point per second)
// const serveRates = [];
// let lastLogTime = Date.now();

// // Clear terminal and plot every second
// setInterval(() => {
//     if (serveRates.length > 0) {
//         console.clear();
//         console.log(`Attempting ${attemptRate} req/s → Limiting to 20 req/s (burst up to 40)`);
//         console.log(`Total: ${totalRequests} | Served: ${served} | Dropped: ${dropped}`);
//         console.log(`Current serve rate: ${(served / totalRequests * 100).toFixed(2)}%`);

//         // Plot the last 60 seconds max for readability
//         const toPlot = serveRates.slice(-60);
//         console.log(asciichart.plot(toPlot, {
//             height: 15,
//             padding: '            ',
//             colors: [asciichart.green],
//             format: (x) => (x * 100).toFixed(1).padStart(6) + '%'
//         }));
//     }
// }, 1000);

// // Send requests at desired rate
// setInterval(() => {
//     totalRequests++;
//     const success = rl.send("some message");
//     if (success) served++;
//     else dropped++;

//     // Update serve rate once per second (more stable plot)
//     const now = Date.now();
//     if (now - lastLogTime >= 1000) {
//         const currentRate = totalRequests === 0 ? 0 : served / totalRequests;
//         serveRates.push(currentRate);
//         lastLogTime = now;
//     }
// }, 1000 / attemptRate);