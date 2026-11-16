import { useRef, useState, type ReactNode } from 'react'
import { Badge, Dropdown } from 'react-bootstrap'

import type { OrganizationMembership } from '../lib/authApi'
import { AdminPanelModal } from './AdminPanelModal'
import { useAuth } from './AuthGate'

const CLOSE_DELAY_MS = 200

type UserMenuProps = {
  children?: ReactNode
  // Called before switching organizations, since switching discards the current workspace state.
  confirmOrganizationSwitch?: (organization: OrganizationMembership) => Promise<boolean>
}

export function UserMenu({ children, confirmOrganizationSwitch }: UserMenuProps) {
  const {
    token,
    userId,
    username,
    role,
    siteAdmin,
    organizations,
    activeOrganization,
    switchOrganization,
    refreshSession,
    logout,
  } = useAuth()
  const [show, setShow] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  function cancelClose() {
    clearTimeout(closeTimeoutRef.current)
  }

  function scheduleClose() {
    cancelClose()
    closeTimeoutRef.current = setTimeout(() => setShow(false), CLOSE_DELAY_MS)
  }

  async function handleSelectOrganization(organization: OrganizationMembership) {
    if (organization.id === activeOrganization.id) {
      return
    }
    setShow(false)
    if (confirmOrganizationSwitch && !(await confirmOrganizationSwitch(organization))) {
      return
    }
    switchOrganization(organization.id)
  }

  return (
    <>
      <Dropdown
        show={show}
        onMouseEnter={() => {
          cancelClose()
          setShow(true)
        }}
        onMouseLeave={scheduleClose}
        align="end"
        className="workspace-user-menu"
      >
        <Dropdown.Toggle
          variant="outline-secondary"
          size="sm"
          onClick={() => setShow((current) => !current)}
        >
          {role === 'admin' && (
            <Badge bg="danger" pill className="me-1">
              ADMIN
            </Badge>
          )}
          <span className="text-body-secondary">{activeOrganization.name}</span>
          <span className="mx-1 text-body-secondary">·</span>
          {username}
        </Dropdown.Toggle>
        <Dropdown.Menu popperConfig={{ modifiers: [{ name: 'offset', options: { offset: [0, 0] } }] }}>
          {organizations.length > 1 && (
            <>
              <Dropdown.Header>Organization</Dropdown.Header>
              {organizations.map((organization) => (
                <Dropdown.Item
                  key={organization.id}
                  active={organization.id === activeOrganization.id}
                  onClick={() => handleSelectOrganization(organization)}
                >
                  {organization.name}
                  {organization.role === 'admin' && <span className="ms-2 small text-body-secondary">admin</span>}
                </Dropdown.Item>
              ))}
              <Dropdown.Divider />
            </>
          )}
          {children}
          {children && <Dropdown.Divider />}
          {siteAdmin && (
            <Dropdown.Item
              onClick={() => {
                setShow(false)
                setShowAdminPanel(true)
              }}
            >
              Admin panel
            </Dropdown.Item>
          )}
          <Dropdown.Item onClick={logout}>Log out</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
      {siteAdmin && (
        <AdminPanelModal
          show={showAdminPanel}
          token={token}
          currentUserId={userId}
          onClose={() => {
            setShowAdminPanel(false)
            // Membership changes may affect the organizations available in this menu.
            refreshSession().catch(() => undefined)
          }}
        />
      )}
    </>
  )
}
