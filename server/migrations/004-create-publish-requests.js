export const id = '004-create-publish-requests'

// One document per requested publish (shift/route/panel) awaiting the maintainer to push it in-game.
export async function up(db) {
  await db.createCollection('publishRequests')
  await db.collection('publishRequests').createIndex({ status: 1 })
  await db.collection('publishRequests').createIndex({ requester: 1 })
}
