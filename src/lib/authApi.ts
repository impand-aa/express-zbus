export type LoginResult = {
  token: string
  username: string
  rank: string
  mustChangePassword: boolean
}

export async function parseJsonResponse(response: Response) {
  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false
  const data = isJson ? await response.json().catch(() => null) : null
  if (!response.ok || !isJson) {
    const message = data && typeof data.error === 'string' ? data.error : `Request failed with status ${response.status}`
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
