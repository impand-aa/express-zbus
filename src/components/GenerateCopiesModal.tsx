import { useEffect, useState } from 'react'
import { Button, Form, Modal, Stack } from 'react-bootstrap'

interface GenerateCopiesModalProps {
  orderNumber: number
  show: boolean
  onClose: () => void
  onConfirm: (copies: number, minuteStep: number) => void
}

export function GenerateCopiesModal({
  orderNumber,
  show,
  onClose,
  onConfirm,
}: GenerateCopiesModalProps) {
  const [copies, setCopies] = useState('2')
  const [minuteStep, setMinuteStep] = useState('10')

  useEffect(() => {
    if (!show) {
      return
    }

    setCopies('2')
    setMinuteStep('10')
  }, [show, orderNumber])

  return (
    <Modal centered show={show} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Generate copies for order {orderNumber}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Stack gap={3} className="compact-form">
          <Form.Group>
            <Form.Label className="soft-label">Copies</Form.Label>
            <Form.Control
              min={1}
              type="number"
              value={copies}
              onChange={(event) => setCopies(event.target.value)}
            />
          </Form.Group>

          <Form.Group>
            <Form.Label className="soft-label">Minute step</Form.Label>
            <Form.Control
              type="number"
              value={minuteStep}
              onChange={(event) => setMinuteStep(event.target.value)}
            />
          </Form.Group>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onConfirm(Number(copies || 0), Number(minuteStep || 0))}>
          Generate copies
        </Button>
      </Modal.Footer>
    </Modal>
  )
}