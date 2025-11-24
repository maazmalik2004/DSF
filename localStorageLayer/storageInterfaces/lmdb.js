import { open } from "lmdb";
import path from "path";

class LMDB {
    constructor(lmdb) {
        this.storage = open({
            path: path.join(process.cwd(), lmdb.storagePath),
            compression: true,
        });
    }

    get(key) {
        const value = this.storage.get(key);
        return value ?? null;
    }

    set(key, value) {
        this.storage.put(key, value);
        return true;
    }

    remove(key) {
        return this.storage.remove(key);
    }
}

export default LMDB;
