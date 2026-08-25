export type LoginResult = {
  token: string
  username: string
  rank: string
  mustChangePassword: boolean
}

// Messages returned by the server's requireAuth middleware, as opposed to unrelated 401s
// (e.g. an incorrect current password on the change-password endpoint).
const SESSION_INVALID_MESSAGES = new Set(['authentication required', 'invalid or expired session'])

type SessionExpiredListener = () => void
const sessionExpiredListeners = new Set<SessionExpiredListener>()

// Lets AuthGate react immediately whenever any authenticated request finds the token invalid,
// on top of the periodic focus-triggered check.
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener)
  return () => sessionExpiredListeners.delete(listener)
}

export async function parseJsonResponse(response: Response) {
  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false
  const data = isJson ? await response.json().catch(() => null) : null
  if (!response.ok || !isJson) {
    const message = data && typeof data.error === 'string' ? data.error : `Request failed with status ${response.status}`
    if (response.status === 401 && SESSION_INVALID_MESSAGES.has(message)) {
      sessionExpiredListeners.forEach((listener) => listener())
    }
    throw new Error(message)
  }
  return data
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return parseJsonResponse(response)
}

export async function changePassword(token: string, currentPassword: string, newPassword: string): Promise<void> {
  const response = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  await parseJsonResponse(response)
}

export async function fetchSession(token: string): Promise<Omit<LoginResult, 'token'>> {
  const response = await fetch('/api/auth/session', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseJsonResponse(response)
}

export async function logout(token: string): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  await parseJsonResponse(response)
}
