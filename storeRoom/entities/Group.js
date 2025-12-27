class Group {
    constructor(group) {
        this.group = group;

        this.id = group.id;
        this.name = group.name;
        this.description = group.description;
        this.nodes = group.nodes; //member nodes
        this.leaders = group.leaders; //elected leaders
    }

    serialize() {
        return JSON.stringify(this.group);
    }

    get() {
        return this.group;
    }

    set(key, value) {
        this.group[key] = value;
        this[key] = value
    }
}

export default Group;