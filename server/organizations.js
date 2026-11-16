import { ObjectId } from 'mongodb'
import { getDb } from './db.js'

export const ORGANIZATION_ROLES = ['admin', 'member']

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i

// Only accepts 24-char hex strings; the ObjectId constructor alone also accepts arbitrary 12-byte strings.
export function parseObjectIdOrNull(rawId) {
  return typeof rawId === 'string' && OBJECT_ID_PATTERN.test(rawId) ? new ObjectId(rawId) : null
}

function normalizeRole(role) {
  return ORGANIZATION_ROLES.includes(role) ? role : 'member'
}

// Every organization the user is a member of, with their role in each, sorted by name.
export async function listUserOrganizations(userId) {
  const docs = await getDb().collection('memberships').aggregate([
    { $match: { userId: new ObjectId(userId) } },
    {
      $lookup: {
        from: 'organizations',
        localField: 'organizationId',
        foreignField: '_id',
        as: 'organization',
      },
    },
    { $unwind: '$organization' },
    { $sort: { 'organization.name': 1 } },
  ]).toArray()

  return docs.map((doc) => ({
    id: doc.organization._id.toString(),
    name: doc.organization.name,
    slug: doc.organization.slug,
    role: normalizeRole(doc.role),
  }))
}

export async function findMembership(userId, organizationId) {
  const doc = await getDb().collection('memberships').findOne({
    userId: new ObjectId(userId),
    organizationId,
  })
  return doc ? { role: normalizeRole(doc.role) } : null
}
