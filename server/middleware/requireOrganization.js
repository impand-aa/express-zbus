import { findMembership, parseObjectIdOrNull } from '../organizations.js'

// Must run after requireAuth on a route mounted with an :organizationId parameter. Membership is
// looked up on every request (rather than cached in the session) so revoked access applies at once.
export async function requireOrganization(req, res, next) {
  try {
    const organizationId = parseObjectIdOrNull(req.params.organizationId)
    if (!organizationId) {
      return res.status(400).json({ error: 'invalid organization id' })
    }

    const membership = await findMembership(req.session.userId, organizationId)
    if (!membership) {
      return res.status(403).json({ error: 'you are not a member of this organization' })
    }

    req.organization = { id: organizationId, role: membership.role }
    next()
  } catch (err) {
    next(err)
  }
}

export function requireOrganizationAdmin(req, res, next) {
  if (req.organization?.role !== 'admin') {
    return res.status(403).json({ error: 'organization admin role required' })
  }
  next()
}
