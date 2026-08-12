export const id = '002-create-reference-modules'

// One document per module type (routes/panels/nums/sounds), storing the raw Luau source text.
export async function up(db) {
  await db.createCollection('referenceModules')
  await db.collection('referenceModules').createIndex({ type: 1 }, { unique: true })
}
