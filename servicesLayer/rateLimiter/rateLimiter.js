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

    async send(request) {
        if (this.tokens == 0) {
            console.log("[RATE-LIMITER] rate limit exeeded, request dropped")
            return null
        }

        this.tokens = this.tokens - 1;
        let response = await this.adapter.send(request)
        console.log("[RATE-LIMITER] request accepted ",response)
        return response
    }
}

export default RateLimiter