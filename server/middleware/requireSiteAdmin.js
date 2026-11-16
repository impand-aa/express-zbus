import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'

// Site admins manage users, organizations and memberships across the whole site. The flag
// (users.siteAdmin: true) is read from the database on every request so revoking it applies at once.
export async function requireSiteAdmin(req, res, next) {
  try {
    const user = await getDb().collection('users').findOne(
      { _id: new ObjectId(req.session.userId) },
      { projection: { siteAdmin: 1 } },
    )
    if (user?.siteAdmin !== true) {
      return res.status(403).json({ error: 'site admin required' })
    }
    next()
  } catch (err) {
    next(err)
  }
}
