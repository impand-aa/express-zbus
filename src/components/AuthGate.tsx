import { createContext, Fragment, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Alert, Button, Card, Container, Form } from 'react-bootstrap'

import { AdminPanelModal } from './AdminPanelModal'

import {
  changePassword,
  fetchSession,
  login,
  logout as logoutRequest,
  onSessionExpired,
  type OrganizationMembership,
  type OrganizationRequestContext,
  type OrganizationRole,
} from '../lib/authApi'

type Session = {
  token: string
  userId: string
  username: string
  mustChangePassword: boolean
  siteAdmin: boolean
  organizations: OrganizationMembership[]
}

const TOKEN_STORAGE_KEY = 'shiftmaker.sessionToken'
const ACTIVE_ORGANIZATION_STORAGE_KEY = 'shiftmaker.activeOrganizationId'

type AuthContextValue = {
  token: string
  userId: string
  username: string
  siteAdmin: boolean
  organizations: OrganizationMembership[]
  activeOrganization: OrganizationMembership
  // The user's role within the active organization.
  role: OrganizationRole
  // Passed to every org-scoped API call so requests always target the active organization.
  organizationRequestContext: OrganizationRequestContext
  switchOrganization: (organizationId: string) => void
  // Re-reads organizations and site admin status, e.g. after the admin panel changes memberships.
  refreshSession: () => Promise<void>
  logout: () => void
}

function readStoredActiveOrganizationId() {
  try {
    return localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeActiveOrganizationId(organizationId: string) {
  try {
    localStorage.setItem(ACTIVE_ORGANIZATION_STORAGE_KEY, organizationId)
  } catch {
    // Remembering the last organization is a convenience; ignore storage failures.
  }
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
  const [isSessionExpired, setIsSessionExpired] = useState(false)
  const [preferredOrganizationId, setPreferredOrganizationId] = useState(readStoredActiveOrganizationId)
  const [showAdminPanel, setShowAdminPanel] = useState(false)

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

  // The free hosting tier can spin the server down after inactivity, silently expiring the
  // token; re-check on focus so users find out before losing work to a failed save.
  useEffect(() => {
    if (!session) {
      return
    }

    let isChecking = false

    function handleFocus() {
      if (isChecking || !session) {
        return
      }
      isChecking = true
      refreshSessionDetails(session)
        .then(() => setIsSessionExpired(false))
        .catch(() => setIsSessionExpired(true))
        .finally(() => {
          isChecking = false
        })
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [session])

  // Also react immediately if any authenticated request (save shift, load shift, etc.) finds
  // the token invalid, instead of waiting for the next focus event.
  useEffect(() => {
    if (!session) {
      return
    }
    return onSessionExpired(() => setIsSessionExpired(true))
  }, [session])

  // Picks up organization membership/role and site admin changes made since sign-in.
  async function refreshSessionDetails(currentSession: Session) {
    const result = await fetchSession(currentSession.token)
    if (
      result.siteAdmin !== currentSession.siteAdmin
      || JSON.stringify(result.organizations) !== JSON.stringify(currentSession.organizations)
    ) {
      setSession((current) => (
        current?.token === currentSession.token
          ? { ...current, siteAdmin: result.siteAdmin, organizations: result.organizations }
          : current
      ))
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const result = await login(username, password)
      localStorage.setItem(TOKEN_STORAGE_KEY, result.token)
      setSession(result)
      setIsSessionExpired(false)
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

  function handleSwitchOrganization(organizationId: string) {
    storeActiveOrganizationId(organizationId)
    setPreferredOrganizationId(organizationId)
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

  const activeOrganization = session.organizations.find((organization) => organization.id === preferredOrganizationId)
    ?? session.organizations[0]

  if (!activeOrganization) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Card style={{ maxWidth: 380, width: '100%' }}>
          <Card.Body>
            <Card.Title className="mb-3">No organization access</Card.Title>
            <p className="text-muted">
              Signed in as <strong>{session.username}</strong>, but this account is not a member of any organization yet.
              {session.siteAdmin ? ' Use the admin panel to create an organization and add yourself to it.' : ' Ask an administrator to add you to one.'}
            </p>
            {session.siteAdmin && (
              <Button className="w-100 mb-2" onClick={() => setShowAdminPanel(true)}>
                Open admin panel
              </Button>
            )}
            <Button variant="outline-secondary" className="w-100" onClick={handleLogout}>
              Log out
            </Button>
          </Card.Body>
        </Card>
        {session.siteAdmin && (
          <AdminPanelModal
            show={showAdminPanel}
            token={session.token}
            currentUserId={session.userId}
            onClose={() => {
              setShowAdminPanel(false)
              refreshSessionDetails(session).catch(() => setIsSessionExpired(true))
            }}
          />
        )}
      </Container>
    )
  }

  const contextValue: AuthContextValue = {
    token: session.token,
    userId: session.userId,
    username: session.username,
    siteAdmin: session.siteAdmin,
    organizations: session.organizations,
    activeOrganization,
    role: activeOrganization.role,
    organizationRequestContext: { token: session.token, organizationId: activeOrganization.id },
    switchOrganization: handleSwitchOrganization,
    refreshSession: () => refreshSessionDetails(session),
    logout: handleLogout,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {isSessionExpired ? (
        <Alert variant="danger" className="mb-0 session-expired-banner">
          Your session has expired (likely due to server inactivity). Your changes may no longer save —
          copy any in-progress work, then sign in again when ready.
        </Alert>
      ) : null}
      {/* Keyed by organization so switching remounts the workspace and no state leaks between organizations. */}
      <Fragment key={activeOrganization.id}>{children}</Fragment>
    </AuthContext.Provider>
  )
}
