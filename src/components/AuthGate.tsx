import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Alert, Button, Card, Container, Form } from 'react-bootstrap'

import { changePassword, fetchSession, login, logout as logoutRequest } from '../lib/authApi'

type Session = {
  token: string
  username: string
  rank: string
  mustChangePassword: boolean
}

const TOKEN_STORAGE_KEY = 'shiftmaker.sessionToken'

type AuthContextValue = {
  token: string
  username: string
  rank: string
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Used by the toolbar's account menu to read the current user and log out.
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthGate')
  }
  return context
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isRestoringSession, setIsRestoringSession] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Restore the session from a saved token so a page refresh doesn't require signing in again.
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!savedToken) {
      setIsRestoringSession(false)
      return
    }
    fetchSession(savedToken)
      .then((result) => setSession({ token: savedToken, ...result }))
      .catch(() => localStorage.removeItem(TOKEN_STORAGE_KEY))
      .finally(() => setIsRestoringSession(false))
  }, [])

  async function handleLogin(event: FormEvent) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const result = await login(username, password)
      localStorage.setItem(TOKEN_STORAGE_KEY, result.token)
      setSession(result)
      setPassword('')
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (newPassword !== confirmNewPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    if (!session) {
      return
    }

    setIsSubmitting(true)
    try {
      await changePassword(session.token, currentPassword, newPassword)
      setSession({ ...session, mustChangePassword: false })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Password change failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleLogout() {
    if (session) {
      logoutRequest(session.token).catch(() => undefined)
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setSession(null)
  }

  if (isRestoringSession) {
    return null
  }

  if (!session) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Card style={{ maxWidth: 380, width: '100%' }}>
          <Card.Body>
            <Card.Title className="mb-3">Sign in</Card.Title>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form onSubmit={handleLogin}>
              <Form.Group className="mb-3" controlId="loginUsername">
                <Form.Label>Username</Form.Label>
                <Form.Control
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="loginPassword">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Form.Group>
              <Button type="submit" disabled={isSubmitting} className="w-100">
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    )
  }

  if (session.mustChangePassword) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Card style={{ maxWidth: 380, width: '100%' }}>
          <Card.Body>
            <Card.Title className="mb-3">Set a new password</Card.Title>
            <p className="text-muted">This is your first login. Choose a new password to continue.</p>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form onSubmit={handleChangePassword}>
              <Form.Group className="mb-3" controlId="currentPassword">
                <Form.Label>Current (temporary) password</Form.Label>
                <Form.Control
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="newPassword">
                <Form.Label>New password</Form.Label>
                <Form.Control
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="confirmNewPassword">
                <Form.Label>Confirm new password</Form.Label>
                <Form.Control
                  type="password"
                  value={confirmNewPassword}
                  onChange={(event) => setConfirmNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Form.Group>
              <Button type="submit" disabled={isSubmitting} className="w-100">
                {isSubmitting ? 'Saving…' : 'Set password and continue'}
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    )
  }

  return (
    <AuthContext.Provider value={{ token: session.token, username: session.username, rank: session.rank, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  )
}
