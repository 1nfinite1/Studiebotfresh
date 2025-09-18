import 'server-only';
import { MongoClient } from 'mongodb';

let client = null;
let db = null;

/**
 * Get MongoDB client instance (singleton)
 * @returns {Promise<MongoClient>} MongoDB client
 */
export async function getMongoClient() {
  if (!client) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    await client.connect();
  }
  
  return client;
}

/**
 * Get MongoDB database instance
 * @returns {Promise<Db>} MongoDB database
 */
export async function getDatabase() {
  if (!db) {
    const mongoClient = await getMongoClient();
    const dbName = process.env.MONGODB_DB || 'studiebot';
    db = mongoClient.db(dbName);
  }
  
  return db;
}

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection is healthy
 */
export async function testConnection() {
  try {
    const database = await getDatabase();
    await database.command({ ping: 1 });
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error.message);
    return false;
  }
}

/**
 * Close database connections
 */
export async function closeConnection() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}