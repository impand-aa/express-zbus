import { useRef, useState, type ReactNode } from 'react'
import { Badge, Dropdown } from 'react-bootstrap'

import { useAuth } from './AuthGate'

const CLOSE_DELAY_MS = 200

export function UserMenu({ children }: { children?: ReactNode }) {
  const { username, rank, logout } = useAuth()
  const [show, setShow] = useState(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  function cancelClose() {
    clearTimeout(closeTimeoutRef.current)
  }

  function scheduleClose() {
    cancelClose()
    closeTimeoutRef.current = setTimeout(() => setShow(false), CLOSE_DELAY_MS)
  }

  return (
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
        {rank === 'admin' && (
          <Badge bg="danger" pill className="me-1">
            ADMIN
          </Badge>
        )}
        {username}
      </Dropdown.Toggle>
      <Dropdown.Menu popperConfig={{ modifiers: [{ name: 'offset', options: { offset: [0, 0] } }] }}>
        {children}
        {children && <Dropdown.Divider />}
        <Dropdown.Item onClick={logout}>Log out</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}
