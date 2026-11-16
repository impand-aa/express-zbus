import { useMemo, useState, type FormEvent } from 'react'
import { Alert, Badge, Button, Col, Form, InputGroup, ListGroup, Modal, Row, Spinner, Tab, Table, Tabs } from 'react-bootstrap'

import {
  createAdminOrganization,
  createAdminUser,
  deleteAdminUser,
  fetchAdminOrganizations,
  fetchAdminUsers,
  removeOrganizationMember,
  renameAdminOrganization,
  resetUserPassword,
  setOrganizationMember,
  setUserSiteAdmin,
  slugifyOrganizationName,
  type AdminOrganization,
  type AdminUser,
} from '../lib/adminApi'
import type { OrganizationRole } from '../lib/authApi'

type AdminPanelModalProps = {
  show: boolean
  token: string
  currentUserId: string
  onClose: () => void
}

type Notice = { variant: 'success' | 'danger'; text: string; temporaryPassword?: string }

const ROLE_OPTIONS: { value: OrganizationRole; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
]

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function AdminPanelModal({ show, token, currentUserId, onClose }: AdminPanelModalProps) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [activeTab, setActiveTab] = useState('organizations')

  // Organizations tab
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)
  const [newOrganizationName, setNewOrganizationName] = useState('')
  const [newOrganizationSlug, setNewOrganizationSlug] = useState('')
  const [isSlugEdited, setIsSlugEdited] = useState(false)

  // Users tab
  const [newUsername, setNewUsername] = useState('')
  // Organizations the new user will be added to, with the role in each.
  const [newUserMemberships, setNewUserMemberships] = useState<Record<string, OrganizationRole>>({})
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | null>(null)

  const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationId) ?? null
  const organizationNames = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name])),
    [organizations],
  )

  async function reload() {
    const [nextUsers, nextOrganizations] = await Promise.all([fetchAdminUsers(token), fetchAdminOrganizations(token)])
    setUsers(nextUsers)
    setOrganizations(nextOrganizations)
    setSelectedOrganizationId((current) => (
      nextOrganizations.some((organization) => organization.id === current) ? current : nextOrganizations[0]?.id ?? null
    ))
  }

  // Fresh data every time the panel opens, since other admins may have changed things meanwhile.
  async function handleShow() {
    setIsLoading(true)
    setNotice(null)
    setPendingDeleteUserId(null)
    try {
      await reload()
    } catch (error) {
      setNotice({ variant: 'danger', text: errorMessage(error, 'Failed to load admin data.') })
    } finally {
      setIsLoading(false)
    }
  }

  // Runs a mutation, reloads the lists, and reports the outcome in the notice area.
  async function runAction(action: () => Promise<Notice | void>, failureText: string) {
    setIsBusy(true)
    setNotice(null)
    try {
      const resultNotice = await action()
      await reload()
      if (resultNotice) setNotice(resultNotice)
    } catch (error) {
      setNotice({ variant: 'danger', text: errorMessage(error, failureText) })
    } finally {
      setIsBusy(false)
      setPendingDeleteUserId(null)
    }
  }

  function handleCreateOrganization(event: FormEvent) {
    event.preventDefault()
    const name = newOrganizationName.trim()
    const slug = newOrganizationSlug.trim()
    void runAction(async () => {
      const created = await createAdminOrganization(token, { name, slug })
      setNewOrganizationName('')
      setNewOrganizationSlug('')
      setIsSlugEdited(false)
      setSelectedOrganizationId(created.id)
      return { variant: 'success', text: `Created organization "${created.name}".` }
    }, 'Failed to create the organization.')
  }

  function handleRenameOrganization(organization: AdminOrganization, name: string) {
    void runAction(async () => {
      const renamed = await renameAdminOrganization(token, organization.id, name)
      return { variant: 'success', text: `Renamed organization to "${renamed.name}".` }
    }, 'Failed to rename the organization.')
  }

  function handleAddMember(organization: AdminOrganization, user: AdminUser, role: OrganizationRole) {
    void runAction(async () => {
      await setOrganizationMember(token, organization.id, user.id, role)
      return { variant: 'success', text: `Added ${user.username} to ${organization.name}.` }
    }, 'Failed to add the member.')
  }

  function handleChangeRole(organization: AdminOrganization, user: AdminUser, role: OrganizationRole) {
    void runAction(() => setOrganizationMember(token, organization.id, user.id, role), 'Failed to change the role.')
  }

  function handleRemoveMember(organization: AdminOrganization, user: AdminUser) {
    void runAction(async () => {
      await removeOrganizationMember(token, organization.id, user.id)
      return { variant: 'success', text: `Removed ${user.username} from ${organization.name}.` }
    }, 'Failed to remove the member.')
  }

  function handleCreateUser(event: FormEvent) {
    event.preventDefault()
    const username = newUsername.trim()
    void runAction(async () => {
      const result = await createAdminUser(token, {
        username,
        memberships: Object.entries(newUserMemberships).map(([organizationId, role]) => ({ organizationId, role })),
      })
      setNewUsername('')
      setNewUserMemberships({})
      return {
        variant: 'success',
        text: `Created user ${result.user.username}. Share this temporary password with them; they must change it on first sign-in.`,
        temporaryPassword: result.temporaryPassword,
      }
    }, 'Failed to create the user.')
  }

  function handleResetPassword(user: AdminUser) {
    void runAction(async () => {
      const result = await resetUserPassword(token, user.id)
      return {
        variant: 'success',
        text: `Reset the password for ${user.username} and signed them out. They must change it on next sign-in.`,
        temporaryPassword: result.temporaryPassword,
      }
    }, 'Failed to reset the password.')
  }

  function handleToggleSiteAdmin(user: AdminUser) {
    void runAction(async () => {
      await setUserSiteAdmin(token, user.id, !user.siteAdmin)
      return {
        variant: 'success',
        text: user.siteAdmin ? `${user.username} is no longer a site admin.` : `${user.username} is now a site admin.`,
      }
    }, 'Failed to change site admin status.')
  }

  function handleDeleteUser(user: AdminUser) {
    if (pendingDeleteUserId !== user.id) {
      setPendingDeleteUserId(user.id)
      return
    }
    void runAction(async () => {
      await deleteAdminUser(token, user.id)
      return { variant: 'success', text: `Deleted user ${user.username}.` }
    }, 'Failed to delete the user.')
  }

  return (
    <Modal show={show} size="xl" onShow={handleShow} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Admin panel</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {notice && (
          <Alert variant={notice.variant} dismissible onClose={() => setNotice(null)}>
            {notice.text}
            {notice.temporaryPassword && (
              <InputGroup className="mt-2" style={{ maxWidth: 360 }}>
                <Form.Control readOnly value={notice.temporaryPassword} className="font-monospace" onFocus={(event) => event.target.select()} />
                <Button variant="outline-light" onClick={() => navigator.clipboard?.writeText(notice.temporaryPassword ?? '')}>
                  Copy
                </Button>
              </InputGroup>
            )}
          </Alert>
        )}

        {isLoading ? (
          <div className="text-center py-5"><Spinner animation="border" /></div>
        ) : (
          <Tabs activeKey={activeTab} onSelect={(key) => setActiveTab(key ?? 'organizations')} className="mb-3">
            <Tab eventKey="organizations" title={`Organizations (${organizations.length})`}>
              <Row className="g-4">
                <Col md={4}>
                  <ListGroup className="mb-3">
                    {organizations.map((organization) => {
                      const memberCount = users.filter((user) => user.memberships.some((entry) => entry.organizationId === organization.id)).length
                      return (
                        <ListGroup.Item
                          key={organization.id}
                          action
                          active={organization.id === selectedOrganizationId}
                          onClick={() => setSelectedOrganizationId(organization.id)}
                          className="d-flex justify-content-between align-items-center"
                        >
                          <span>
                            {organization.name}
                            <div className="small opacity-75 font-monospace">{organization.slug}</div>
                          </span>
                          <Badge bg="secondary" pill>{memberCount}</Badge>
                        </ListGroup.Item>
                      )
                    })}
                    {organizations.length === 0 && <ListGroup.Item className="text-body-secondary">No organizations yet.</ListGroup.Item>}
                  </ListGroup>

                  <Form onSubmit={handleCreateOrganization}>
                    <h6>New organization</h6>
                    <Form.Group className="mb-2" controlId="adminNewOrganizationName">
                      <Form.Label className="small">Name</Form.Label>
                      <Form.Control
                        size="sm"
                        value={newOrganizationName}
                        maxLength={100}
                        required
                        onChange={(event) => {
                          setNewOrganizationName(event.target.value)
                          if (!isSlugEdited) setNewOrganizationSlug(slugifyOrganizationName(event.target.value))
                        }}
                      />
                    </Form.Group>
                    <Form.Group className="mb-2" controlId="adminNewOrganizationSlug">
                      <Form.Label className="small">Slug</Form.Label>
                      <Form.Control
                        size="sm"
                        className="font-monospace"
                        value={newOrganizationSlug}
                        maxLength={64}
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                        title="Lowercase letters and digits separated by single dashes"
                        required
                        onChange={(event) => {
                          setNewOrganizationSlug(event.target.value)
                          setIsSlugEdited(true)
                        }}
                      />
                    </Form.Group>
                    <Button type="submit" size="sm" disabled={isBusy}>Create organization</Button>
                  </Form>
                </Col>

                <Col md={8}>
                  {selectedOrganization ? (
                    <OrganizationDetails
                      // Keyed so the rename and add-member inputs reset when the selection or name changes.
                      key={`${selectedOrganization.id}:${selectedOrganization.name}`}
                      organization={selectedOrganization}
                      users={users}
                      currentUserId={currentUserId}
                      isBusy={isBusy}
                      onRename={(name) => handleRenameOrganization(selectedOrganization, name)}
                      onAddMember={(user, role) => handleAddMember(selectedOrganization, user, role)}
                      onChangeRole={(user, role) => handleChangeRole(selectedOrganization, user, role)}
                      onRemoveMember={(user) => handleRemoveMember(selectedOrganization, user)}
                    />
                  ) : (
                    <p className="text-body-secondary">Create an organization to manage its members.</p>
                  )}
                </Col>
              </Row>
            </Tab>

            <Tab eventKey="users" title={`Users (${users.length})`}>
              <Form onSubmit={handleCreateUser} className="mb-4">
                <h6>New user</h6>
                <Row className="g-2 align-items-start">
                  <Col md={4}>
                    <Form.Label className="small" htmlFor="adminNewUsername">Username</Form.Label>
                    <Form.Control
                      id="adminNewUsername"
                      size="sm"
                      value={newUsername}
                      maxLength={64}
                      pattern="[A-Za-z0-9_.\-]+"
                      title="Letters, digits, _ . or -"
                      required
                      onChange={(event) => setNewUsername(event.target.value)}
                    />
                  </Col>
                  <Col md={6}>
                    <div className="small mb-1">Organizations (optional)</div>
                    {organizations.length === 0 && <div className="small text-body-secondary">No organizations yet.</div>}
                    {organizations.map((organization) => {
                      const selectedRole = newUserMemberships[organization.id]
                      return (
                        <div key={organization.id} className="d-flex align-items-center gap-2 mb-1">
                          <Form.Check
                            id={`adminNewUserOrganization-${organization.id}`}
                            className="flex-grow-1 mb-0"
                            label={organization.name}
                            checked={selectedRole !== undefined}
                            onChange={(event) => setNewUserMemberships((current) => {
                              const next = { ...current }
                              if (event.target.checked) next[organization.id] = 'member'
                              else delete next[organization.id]
                              return next
                            })}
                          />
                          <Form.Select
                            size="sm"
                            style={{ maxWidth: 120 }}
                            aria-label={`Role in ${organization.name}`}
                            value={selectedRole ?? 'member'}
                            disabled={selectedRole === undefined}
                            onChange={(event) => setNewUserMemberships((current) => ({
                              ...current,
                              [organization.id]: event.target.value as OrganizationRole,
                            }))}
                          >
                            {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </Form.Select>
                        </div>
                      )
                    })}
                  </Col>
                  <Col md={2}>
                    <Button type="submit" size="sm" className="w-100" disabled={isBusy}>Create user</Button>
                  </Col>
                </Row>
              </Form>

              <Table size="sm" hover responsive className="align-middle">
                <thead>
                  <tr><th>User</th><th>Organizations</th><th className="text-end">Actions</th></tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isSelf = user.id === currentUserId
                    return (
                      <tr key={user.id}>
                        <td>
                          {user.username}
                          {isSelf && <span className="ms-2 small text-body-secondary">(you)</span>}
                          {user.siteAdmin && <Badge bg="danger" pill className="ms-2">SITE ADMIN</Badge>}
                          {user.mustChangePassword && <Badge bg="warning" text="dark" pill className="ms-2">password change pending</Badge>}
                        </td>
                        <td className="small" style={{ minWidth: 300 }}>
                          <UserOrganizationsEditor
                            user={user}
                            organizations={organizations}
                            organizationNames={organizationNames}
                            isBusy={isBusy}
                            onSetRole={(organization, role) => handleChangeRole(organization, user, role)}
                            onAdd={(organization, role) => handleAddMember(organization, user, role)}
                            onRemove={(organization) => handleRemoveMember(organization, user)}
                          />
                        </td>
                        <td className="text-end text-nowrap">
                          {isSelf ? (
                            <span className="small text-body-secondary">Manage your own account elsewhere</span>
                          ) : (
                            <>
                              <Button size="sm" variant="outline-secondary" className="me-1" disabled={isBusy} onClick={() => handleResetPassword(user)}>
                                Reset password
                              </Button>
                              <Button size="sm" variant="outline-secondary" className="me-1" disabled={isBusy} onClick={() => handleToggleSiteAdmin(user)}>
                                {user.siteAdmin ? 'Revoke site admin' : 'Make site admin'}
                              </Button>
                              <Button
                                size="sm"
                                variant={pendingDeleteUserId === user.id ? 'danger' : 'outline-danger'}
                                disabled={isBusy}
                                onClick={() => handleDeleteUser(user)}
                                onBlur={() => setPendingDeleteUserId((current) => (current === user.id ? null : current))}
                              >
                                {pendingDeleteUserId === user.id ? 'Confirm delete' : 'Delete'}
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </Tab>
          </Tabs>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  )
}

type OrganizationDetailsProps = {
  organization: AdminOrganization
  users: AdminUser[]
  currentUserId: string
  isBusy: boolean
  onRename: (name: string) => void
  onAddMember: (user: AdminUser, role: OrganizationRole) => void
  onChangeRole: (user: AdminUser, role: OrganizationRole) => void
  onRemoveMember: (user: AdminUser) => void
}

function OrganizationDetails({
  organization,
  users,
  currentUserId,
  isBusy,
  onRename,
  onAddMember,
  onChangeRole,
  onRemoveMember,
}: OrganizationDetailsProps) {
  const [renameValue, setRenameValue] = useState(organization.name)
  const [memberToAddId, setMemberToAddId] = useState('')
  const [memberToAddRole, setMemberToAddRole] = useState<OrganizationRole>('member')

  const members = useMemo(() => users.flatMap((user) => {
    const membership = user.memberships.find((entry) => entry.organizationId === organization.id)
    return membership ? [{ user, role: membership.role }] : []
  }), [organization.id, users])
  const nonMembers = users.filter((user) => !members.some((member) => member.user.id === user.id))

  function handleRename(event: FormEvent) {
    event.preventDefault()
    onRename(renameValue.trim())
  }

  function handleAddMember(event: FormEvent) {
    event.preventDefault()
    const user = users.find((entry) => entry.id === memberToAddId)
    if (!user) return
    onAddMember(user, memberToAddRole)
    setMemberToAddId('')
  }

  return (
    <>
      <Form onSubmit={handleRename} className="mb-3">
        <Form.Label className="small" htmlFor="adminOrganizationName">Organization name</Form.Label>
        <InputGroup size="sm">
          <Form.Control id="adminOrganizationName" value={renameValue} maxLength={100} required onChange={(event) => setRenameValue(event.target.value)} />
          <Button type="submit" variant="outline-secondary" disabled={isBusy || !renameValue.trim() || renameValue.trim() === organization.name}>
            Rename
          </Button>
        </InputGroup>
      </Form>

      <h6>Members</h6>
      <Table size="sm" hover className="align-middle">
        <thead>
          <tr><th>User</th><th style={{ width: 140 }}>Role</th><th style={{ width: 100 }} /></tr>
        </thead>
        <tbody>
          {members.map(({ user, role }) => (
            <tr key={user.id}>
              <td>
                {user.username}
                {user.id === currentUserId && <span className="ms-2 small text-body-secondary">(you)</span>}
              </td>
              <td>
                <Form.Select size="sm" value={role} disabled={isBusy} aria-label={`Role of ${user.username}`} onChange={(event) => onChangeRole(user, event.target.value as OrganizationRole)}>
                  {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Form.Select>
              </td>
              <td className="text-end">
                <Button size="sm" variant="outline-danger" disabled={isBusy} onClick={() => onRemoveMember(user)}>Remove</Button>
              </td>
            </tr>
          ))}
          {members.length === 0 && (
            <tr><td colSpan={3} className="text-body-secondary">No members yet.</td></tr>
          )}
        </tbody>
      </Table>

      <Form onSubmit={handleAddMember}>
        <InputGroup size="sm">
          <Form.Select value={memberToAddId} onChange={(event) => setMemberToAddId(event.target.value)} aria-label="User to add">
            <option value="">Add a user…</option>
            {nonMembers.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
          </Form.Select>
          <Form.Select value={memberToAddRole} onChange={(event) => setMemberToAddRole(event.target.value as OrganizationRole)} style={{ maxWidth: 130 }} aria-label="Role">
            {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Form.Select>
          <Button type="submit" disabled={isBusy || !memberToAddId}>Add member</Button>
        </InputGroup>
      </Form>
    </>
  )
}

type UserOrganizationsEditorProps = {
  user: AdminUser
  organizations: AdminOrganization[]
  organizationNames: Map<string, string>
  isBusy: boolean
  onSetRole: (organization: AdminOrganization, role: OrganizationRole) => void
  onAdd: (organization: AdminOrganization, role: OrganizationRole) => void
  onRemove: (organization: AdminOrganization) => void
}

// Lists every organization the user belongs to (role editable, removable) plus a row to add another.
function UserOrganizationsEditor({ user, organizations, organizationNames, isBusy, onSetRole, onAdd, onRemove }: UserOrganizationsEditorProps) {
  const [organizationToAddId, setOrganizationToAddId] = useState('')
  const [roleToAdd, setRoleToAdd] = useState<OrganizationRole>('member')

  const organizationsById = new Map(organizations.map((organization) => [organization.id, organization]))
  const availableOrganizations = organizations.filter(
    (organization) => !user.memberships.some((membership) => membership.organizationId === organization.id),
  )

  function handleAdd(event: FormEvent) {
    event.preventDefault()
    const organization = organizationsById.get(organizationToAddId)
    if (!organization) return
    onAdd(organization, roleToAdd)
    setOrganizationToAddId('')
  }

  return (
    <>
      {user.memberships.length === 0 && <div className="text-body-secondary mb-1">No organizations</div>}
      {user.memberships.map((membership) => {
        const organization = organizationsById.get(membership.organizationId)
        const name = organizationNames.get(membership.organizationId) ?? 'Unknown'
        return (
          <div key={membership.organizationId} className="d-flex align-items-center gap-1 mb-1">
            <span className="flex-grow-1 text-truncate" title={name}>{name}</span>
            <Form.Select
              size="sm"
              style={{ maxWidth: 110 }}
              aria-label={`Role of ${user.username} in ${name}`}
              value={membership.role}
              disabled={isBusy || !organization}
              onChange={(event) => organization && onSetRole(organization, event.target.value as OrganizationRole)}
            >
              {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Form.Select>
            <Button
              size="sm"
              variant="outline-danger"
              title={`Remove ${user.username} from ${name}`}
              aria-label={`Remove ${user.username} from ${name}`}
              disabled={isBusy || !organization}
              onClick={() => organization && onRemove(organization)}
            >
              ×
            </Button>
          </div>
        )
      })}
      {availableOrganizations.length > 0 && (
        <Form onSubmit={handleAdd}>
          <InputGroup size="sm">
            <Form.Select
              value={organizationToAddId}
              aria-label={`Organization to add ${user.username} to`}
              onChange={(event) => setOrganizationToAddId(event.target.value)}
            >
              <option value="">Add to organization…</option>
              {availableOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
            </Form.Select>
            <Form.Select
              style={{ maxWidth: 110 }}
              aria-label="Role"
              value={roleToAdd}
              onChange={(event) => setRoleToAdd(event.target.value as OrganizationRole)}
            >
              {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Form.Select>
            <Button type="submit" disabled={isBusy || !organizationToAddId}>Add</Button>
          </InputGroup>
        </Form>
      )}
    </>
  )
}
