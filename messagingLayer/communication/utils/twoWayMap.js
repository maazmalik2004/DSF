class TwoWayMap {
  constructor() {
    this.keyToValue = new Map();
    this.valueToKey = new Map();
  }

  set(key, value) {
    if (this.keyToValue.has(key)) {
      const oldValue = this.keyToValue.get(key);
      this.valueToKey.delete(oldValue);
    }
    if (this.valueToKey.has(value)) {
      const oldKey = this.valueToKey.get(value);
      this.keyToValue.delete(oldKey);
    }

    this.keyToValue.set(key, value);
    this.valueToKey.set(value, key);
  }

  getByKey(key) {
    return this.keyToValue.get(key);
  }

  getByValue(value) {
    return this.valueToKey.get(value);
  }

  deleteByKey(key) {
    if (!this.keyToValue.has(key)) return;
    const value = this.keyToValue.get(key);
    this.keyToValue.delete(key);
    this.valueToKey.delete(value);
  }

  deleteByValue(value) {
    if (!this.valueToKey.has(value)) return;
    const key = this.valueToKey.get(value);
    this.valueToKey.delete(value);
    this.keyToValue.delete(key);
  }
}

export default TwoWayMap;