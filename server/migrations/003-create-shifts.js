export const id = '003-create-shifts'

// One document per shift module (000-999), storing the raw Luau source text plus who last updated it.
export async function up(db) {
  await db.createCollection('shifts')
  await db.collection('shifts').createIndex({ moduleName: 1 }, { unique: true })
}
