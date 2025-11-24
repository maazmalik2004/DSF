import { MongoClient } from 'mongodb';

class MongoDB {
  constructor(mongoDb) {
    this.uri = mongoDb.uri;
    this.dbName = mongoDb.dbName;
    this.collectionName = mongoDb.collectionName;
    this.client = new MongoClient(this.uri);
    this.collection = null;
  }

  async connect() {
    if (!this.collection) {
      await this.client.connect();
      const db = this.client.db(this.dbName);
      this.collection = db.collection(this.collectionName);
    }
  }

  async get(key) {
    await this.connect();
    const doc = await this.collection.findOne({ _id: key });
    return doc ? doc.value : null;
  }

  async set(key, value) {
    await this.connect();
    await this.collection.replaceOne(
      { _id: key },
      { _id: key, value },
      { upsert: true }
    );
  }

  async remove(key) {
    await this.connect();
    const result = await this.collection.deleteOne({ _id: key });
    return result.deletedCount > 0;
  }
}

export default MongoDB;