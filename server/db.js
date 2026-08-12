import { MongoClient } from 'mongodb'
import dns from 'node:dns'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

// Load .env from the repo root regardless of the caller's working directory
// (dotenv/config alone only looks at process.cwd()).
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
config({ path: path.join(repoRoot, '.env') })

// Work around environments where Node's resolver picks an unreachable DNS
// server (e.g. loopback), which breaks mongodb+srv:// SRV/TXT lookups.
dns.setServers(['1.1.1.1', '8.8.8.8'])

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
const dbName = process.env.MONGODB_DB_NAME || 'shiftmaker'

let client
let db

export async function connectToDatabase() {
  if (db) return db

  client = new MongoClient(uri)
  await client.connect()
  db = client.db(dbName)
  console.log(`Connected to MongoDB database "${dbName}"`)
  return db
}

export function getDb() {
  if (!db) throw new Error('Database not connected. Call connectToDatabase() first.')
  return db
}

export async function closeDatabaseConnection() {
  if (client) await client.close()
  client = undefined
  db = undefined
}
