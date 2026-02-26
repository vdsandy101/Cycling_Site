import { MongoClient } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let mongoClientPromise: Promise<MongoClient> | null = null;

function getMongoClientPromise() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (!mongoClientPromise) {
    const client = new MongoClient(uri);
    mongoClientPromise = global._mongoClientPromise ?? client.connect();
    if (process.env.NODE_ENV !== "production") {
      global._mongoClientPromise = mongoClientPromise;
    }
  }

  return mongoClientPromise;
}

export async function getDb() {
  const dbName = process.env.MONGODB_DB;
  if (!dbName) {
    throw new Error("Missing MONGODB_DB environment variable");
  }

  const connectedClient = await getMongoClientPromise();
  return connectedClient.db(dbName);
}
