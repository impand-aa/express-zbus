import { useMemo, useState } from 'react'
import { Alert, Button, Form, Modal, Stack } from 'react-bootstrap'

interface LiveRouteUpdateModalProps {
  error: string
  show: boolean
  source: string
  onClose: () => void
}

export function LiveRouteUpdateModal({
  error,
  show,
  source,
  onClose,
}: LiveRouteUpdateModalProps) {
  const [copyMessage, setCopyMessage] = useState('')
  const copyDisabled = useMemo(() => Boolean(error) || !source.trim(), [error, source])

  async function copySource() {
    if (copyDisabled) {
      return
    }

    try {
      await navigator.clipboard.writeText(source)
      setCopyMessage('Temporary route live update code copied to the clipboard.')
    } catch {
      setCopyMessage('Clipboard access failed. Copy the code from the text area instead.')
    }
  }

  return (
    <Modal centered scrollable show={show} size="lg" onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Temporary route live update code</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Stack gap={3} className="compact-form">
          <Alert variant="info" className="mb-0 compact-alert">
            This snippet appends temporary route definitions with only a single <code>{'{"panel", 910}'}</code> order. Route schedules can then be built in the main shift editor.
          </Alert>

          {error ? (
            <Alert variant="warning" className="mb-0 compact-alert">
              {error}
            </Alert>
          ) : null}

          <Form.Group>
            <Form.Label className="soft-label">Developer console code</Form.Label>
            <Form.Control
              as="textarea"
              className="code-textarea"
              readOnly
              rows={20}
              spellCheck={false}
              value={source}
            />
          </Form.Group>

          {copyMessage ? (
            <div className="toolbar-note toolbar-note--info">{copyMessage}</div>
          ) : null}
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose}>
          Close
        </Button>
        <Button disabled={copyDisabled} variant="primary" onClick={copySource}>
          Copy code
        </Button>
      </Modal.Footer>
    </Modal>
  )
}