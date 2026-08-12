import { Button, Modal } from 'react-bootstrap'

interface ConfirmModalProps {
  cancelLabel?: string
  confirmLabel?: string
  confirmVariant?: string
  message: string
  show: boolean
  title?: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmModal({
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  message,
  show,
  title = 'Please confirm',
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Modal centered show={show} onHide={onCancel}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{message}</Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
