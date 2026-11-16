import { parseJsonResponse, type OrganizationRole } from './authApi'

// Site admin panel API (/api/admin); every call requires a site admin session.

export type AdminOrganization = {
  id: string
  name: string
  slug: string
  createdAt: string
}

export type AdminUser = {
  id: string
  username: string
  siteAdmin: boolean
  mustChangePassword: boolean
  memberships: { organizationId: string; role: OrganizationRole }[]
}

function request(token: string, method: string, path: string, body?: unknown) {
  return fetch(`/api/admin${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(parseJsonResponse)
}

const id = encodeURIComponent

export function fetchAdminUsers(token: string): Promise<AdminUser[]> {
  return request(token, 'GET', '/users')
}

export function createAdminUser(
  token: string,
  user: { username: string; memberships: { organizationId: string; role: OrganizationRole }[] },
): Promise<{ user: AdminUser; temporaryPassword: string }> {
  return request(token, 'POST', '/users', user)
}

export async function setUserSiteAdmin(token: string, userId: string, siteAdmin: boolean): Promise<void> {
  await request(token, 'PATCH', `/users/${id(userId)}`, { siteAdmin })
}

export function resetUserPassword(token: string, userId: string): Promise<{ temporaryPassword: string }> {
  return request(token, 'POST', `/users/${id(userId)}/reset-password`)
}

export async function deleteAdminUser(token: string, userId: string): Promise<void> {
  await request(token, 'DELETE', `/users/${id(userId)}`)
}

export function fetchAdminOrganizations(token: string): Promise<AdminOrganization[]> {
  return request(token, 'GET', '/organizations')
}

export function createAdminOrganization(token: string, organization: { name: string; slug: string }): Promise<AdminOrganization> {
  return request(token, 'POST', '/organizations', organization)
}

export function renameAdminOrganization(token: string, organizationId: string, name: string): Promise<AdminOrganization> {
  return request(token, 'PATCH', `/organizations/${id(organizationId)}`, { name })
}

export async function setOrganizationMember(token: string, organizationId: string, userId: string, role: OrganizationRole): Promise<void> {
  await request(token, 'PUT', `/organizations/${id(organizationId)}/members/${id(userId)}`, { role })
}

export async function removeOrganizationMember(token: string, organizationId: string, userId: string): Promise<void> {
  await request(token, 'DELETE', `/organizations/${id(organizationId)}/members/${id(userId)}`)
}

// Suggests a slug from an organization name, e.g. "North Depot #2" -> "north-depot-2".
export function slugifyOrganizationName(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '')
}
