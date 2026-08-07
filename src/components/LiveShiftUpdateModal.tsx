import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Form, Modal, Stack } from 'react-bootstrap'

import { generateLiveShiftUpdateSource } from '../lib/liveShiftUpdate'

interface LiveShiftUpdateModalProps {
  defaultLine: string
  shiftSource: string
  show: boolean
  onClose: () => void
}

export function LiveShiftUpdateModal({
  defaultLine,
  shiftSource,
  show,
  onClose,
}: LiveShiftUpdateModalProps) {
  const [line, setLine] = useState(defaultLine)
  const [copyMessage, setCopyMessage] = useState('')

  useEffect(() => {
    if (!show) {
      return
    }

    setLine(defaultLine)
    setCopyMessage('')
  }, [defaultLine, show])

  const preview = useMemo(() => {
    try {
      return {
        error: '',
        source: generateLiveShiftUpdateSource(shiftSource, line),
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Could not generate live update code.',
        source: '',
      }
    }
  }, [line, shiftSource])

  async function copySource() {
    if (!preview.source) {
      return
    }

    try {
      await navigator.clipboard.writeText(preview.source)
      setCopyMessage('Live update code copied to the clipboard.')
    } catch {
      setCopyMessage('Clipboard access failed. Copy the code from the text area instead.')
    }
  }

  return (
    <Modal centered scrollable show={show} size="lg" onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Live shift update code</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Stack gap={3} className="compact-form">
          {/* <Alert variant="info" className="mb-0 compact-alert">
            This snippet requires the in-game Shifts module, keeps the exported plan intact, and calls RegisterShift with the line below.
          </Alert> */}

          <Form.Group>
            <Form.Label className="soft-label">Line</Form.Label>
            <Form.Control
              placeholder="e.g. 847"
              value={line}
              onChange={(event) => {
                setLine(event.target.value)
                setCopyMessage('')
              }}
            />
            <Form.Text className="text-secondary">
              Numeric shift module name which to update.
            </Form.Text>
          </Form.Group>

          {preview.error ? (
            <Alert variant="warning" className="mb-0 compact-alert">
              {preview.error}
            </Alert>
          ) : null}

          <Form.Group>
            <Form.Label className="soft-label">Developer console code</Form.Label>
            <Form.Control
              as="textarea"
              className="code-textarea"
              readOnly
              rows={18}
              spellCheck={false}
              value={preview.source}
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
        <Button disabled={!preview.source} variant="primary" onClick={copySource}>
          Copy code
        </Button>
      </Modal.Footer>
    </Modal>
  )
}