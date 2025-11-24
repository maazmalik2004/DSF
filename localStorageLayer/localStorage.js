class LocalStorage {
    constructor(localStorage){
        this.interface = localStorage.interface;
    }

    get(key) {
        return this.interface.get(key);
    }

    set(key, value) {
        this.interface.set(key, value)
    }

    remove(key) {
        this.interface.remove(key);
    }
}

export default LocalStorage;