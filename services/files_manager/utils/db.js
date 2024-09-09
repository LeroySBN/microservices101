// MongoDB utils
const { MongoClient } = require('mongodb');
// import {MongoClient} from 'mongodb';

require('@dotenvx/dotenvx').config()

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || 27017;
const database = process.env.DB_DATABASE || 'files_manager';

const url = `mongodb://${host}:${port}`;

class DBClient {
  constructor() {
    this.client = new MongoClient(url, { useUnifiedTopology: true, useNewUrlParser: true });
    this.client.connect().then(() => {
      this.db = this.client.db(`${database}`);
    }).catch((err) => {
      console.log(err);
    });
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    const usersCollection = this.db.collection('users');
    const userCount = await usersCollection.countDocuments();
    return userCount;
  }

  async nbFiles() {
    const filesCollection = this.db.collection('files');
    const fileCount = await filesCollection.countDocuments();
    return fileCount;
  }
}

const dbClient = new DBClient();

export default dbClient;
