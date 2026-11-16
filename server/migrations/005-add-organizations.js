export const id = '005-add-organizations'

// Introduces multi-tenancy: every shift, reference module and publish request now belongs to an
// organization, and users access organizations through memberships with a per-organization role.
//
// Collections added:
//   organizations: { _id, name, slug (unique), createdAt }
//   memberships:   { _id, userId: ObjectId, organizationId: ObjectId, role: 'admin' | 'member', createdAt }
//
// Like user accounts, organizations and memberships are provisioned directly in Atlas: insert an
// organizations document, then one memberships document per user who should have access.
//
// Existing data is moved into a single default organization (name/slug configurable through
// DEFAULT_ORGANIZATION_NAME / DEFAULT_ORGANIZATION_SLUG), and every existing user becomes a member of
// it, with users whose legacy global `rank` is 'admin' becoming organization admins. The legacy
// `users.rank` field is left in place but is no longer read by the app.
const SCOPED_COLLECTIONS = ['referenceModules', 'shifts', 'publishRequests']

async function dropIndexIfExists(collection, indexName) {
  if (await collection.indexExists(indexName)) {
    await collection.dropIndex(indexName)
  }
}

export async function up(db) {
  await db.createCollection('organizations')
  await db.collection('organizations').createIndex({ slug: 1 }, { unique: true })

  await db.createCollection('memberships')
  await db.collection('memberships').createIndex({ userId: 1, organizationId: 1 }, { unique: true })
  await db.collection('memberships').createIndex({ organizationId: 1 })

  const now = new Date()
  const { insertedId: organizationId } = await db.collection('organizations').insertOne({
    name: process.env.DEFAULT_ORGANIZATION_NAME?.trim() || 'Default organization',
    slug: process.env.DEFAULT_ORGANIZATION_SLUG?.trim() || 'default',
    createdAt: now,
  })

  for (const collectionName of SCOPED_COLLECTIONS) {
    await db.collection(collectionName).updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId } },
    )
  }

  const users = await db.collection('users').find({}, { projection: { _id: 1, rank: 1 } }).toArray()
  if (users.length > 0) {
    await db.collection('memberships').insertMany(users.map((user) => ({
      userId: user._id,
      organizationId,
      role: user.rank === 'admin' ? 'admin' : 'member',
      createdAt: now,
    })))
  }

  // Uniqueness is now per organization rather than global.
  const referenceModules = db.collection('referenceModules')
  await dropIndexIfExists(referenceModules, 'type_1')
  await referenceModules.createIndex({ organizationId: 1, type: 1 }, { unique: true })

  const shifts = db.collection('shifts')
  await dropIndexIfExists(shifts, 'moduleName_1')
  await shifts.createIndex({ organizationId: 1, moduleName: 1 }, { unique: true })

  const publishRequests = db.collection('publishRequests')
  await dropIndexIfExists(publishRequests, 'status_1')
  await dropIndexIfExists(publishRequests, 'requester_1')
  await publishRequests.createIndex({ organizationId: 1, updatedAt: -1 })
  await publishRequests.createIndex({ organizationId: 1, status: 1 })
  await publishRequests.createIndex({ organizationId: 1, requester: 1 })
}
