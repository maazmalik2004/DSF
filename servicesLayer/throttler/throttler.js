class Throttler {
    constructor(object) {
        this.rate = object.rate || 15;
        this.queue = [];
        this.adapter = object.adapter;

        setInterval(async () => {
            if (this.queue.length === 0) return;

            const { request, resolve, reject } = this.queue.shift();

            const response = await this.adapter.send(request);
            resolve(response);
        }, 1000 / this.rate);
    }

    send(request) {
        return new Promise((resolve, reject) => {
            console.log("[THROTTLER] pushing into queue")
            this.queue.push({ request, resolve, reject });
        });
    }
}

export default Throttler;
