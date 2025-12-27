class Node {
    constructor(node) {
        this.node = node;

        this.id = node.id;
        this.name = node.name;
    }

    serialize() {
        return JSON.stringify(this.node, null, 4);
    }

    get() {
        return this.node;
    }

    set(key, value) {
        this.node[key] = value;
        this[key] = value
    }
}

export default Node;