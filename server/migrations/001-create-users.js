export const id = '001-create-users'

// _id (ObjectId) serves as the user's id; no separate id field is stored.
// Accounts are created directly in Atlas with username/password/rank; omit
// mustChangePassword (or set it to true) to force a password change on first login.
export async function up(db) {
  await db.createCollection('users')
  await db.collection('users').createIndex({ username: 1 }, { unique: true })
}
