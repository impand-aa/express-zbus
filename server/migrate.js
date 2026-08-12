import 'dotenv/config'
import { connectToDatabase, closeDatabaseConnection } from './db.js'
import * as createUsers from './migrations/001-create-users.js'
import * as createReferenceModules from './migrations/002-create-reference-modules.js'
import * as createShifts from './migrations/003-create-shifts.js'
import * as createPublishRequests from './migrations/004-create-publish-requests.js'

// Add new migrations here, in the order they should run.
const migrations = [createUsers, createReferenceModules, createShifts, createPublishRequests]

async function run() {
  const db = await connectToDatabase()
  const appliedMigrations = db.collection('_migrations')

  for (const migration of migrations) {
    const alreadyApplied = await appliedMigrations.findOne({ id: migration.id })
    if (alreadyApplied) {
      console.log(`Skipping already applied migration: ${migration.id}`)
      continue
    }

    console.log(`Applying migration: ${migration.id}`)
    await migration.up(db)
    await appliedMigrations.insertOne({ id: migration.id, appliedAt: new Date() })
  }

  await closeDatabaseConnection()
}

run().catch((err) => {
  console.error('Migration failed:', err)
  process.exitCode = 1
})
