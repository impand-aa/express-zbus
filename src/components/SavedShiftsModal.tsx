import { useEffect, useState } from 'react'
import { Button, ButtonGroup, Form, Modal, Table } from 'react-bootstrap'

import type { ShiftRecord } from '../lib/shiftApi'

interface SavedShiftsModalProps {
  canSaveCurrent: boolean
  currentModuleName: string
  mode: 'save' | 'browse'
  savingModuleName: string | null
  shifts: ShiftRecord[]
  show: boolean
  onClose: () => void
  onLoad: (moduleName: string) => void
  onSave: (moduleName: string) => void
}

function sortShiftRecords(shifts: ShiftRecord[]) {
  return [...shifts].sort((left, right) => (
    left.moduleName.localeCompare(right.moduleName, undefined, { numeric: true, sensitivity: 'base' })
  ))
}

function formatUpdatedAt(updatedAt: string) {
  const parsed = new Date(updatedAt)
  return Number.isNaN(parsed.getTime()) ? '?' : parsed.toLocaleString()
}

export function SavedShiftsModal({
  canSaveCurrent,
  currentModuleName,
  mode,
  savingModuleName,
  shifts,
  show,
  onClose,
  onLoad,
  onSave,
}: SavedShiftsModalProps) {
  const [newModuleName, setNewModuleName] = useState(currentModuleName)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (show) {
      setNewModuleName(currentModuleName)
      setSearchTerm('')
    }
  }, [currentModuleName, show])

  const sortedShifts = sortShiftRecords(shifts)
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const visibleShifts = normalizedSearchTerm
    ? sortedShifts.filter((shift) => (
        shift.moduleName.toLowerCase().includes(normalizedSearchTerm)
        || shift.updatedBy?.toLowerCase().includes(normalizedSearchTerm)
      ))
    : sortedShifts

  return (
    <Modal show={show} size="lg" onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Saved shifts</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {mode === 'save' ? (
          <Form.Group className="d-flex gap-2 align-items-end mb-3">
            <div className="flex-grow-1">
              <Form.Label className="soft-label">Save current shift as</Form.Label>
              <Form.Control
                placeholder="e.g. 847"
                size="sm"
                value={newModuleName}
                onChange={(event) => setNewModuleName(event.target.value)}
              />
            </div>
            <Button
              disabled={!canSaveCurrent || !newModuleName.trim() || savingModuleName === newModuleName.trim()}
              size="sm"
              variant="success"
              onClick={() => onSave(newModuleName.trim())}
            >
              {savingModuleName === newModuleName.trim() ? 'Saving…' : 'Save'}
            </Button>
          </Form.Group>
        ) : (
          <Form.Group className="mb-3">
            <Form.Label className="soft-label">Search</Form.Label>
            <Form.Control
              placeholder="Filter by module name or updated by"
              size="sm"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </Form.Group>
        )}

        {sortedShifts.length === 0 ? (
          <p className="text-secondary mb-0">No shifts have been saved on the server yet.</p>
        ) : visibleShifts.length === 0 ? (
          <p className="text-secondary mb-0">No saved shifts match your search.</p>
        ) : (
          <Table hover responsive size="sm" variant="dark">
            <thead>
              <tr>
                <th>Module</th>
                <th>Updated by</th>
                <th>Updated at</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleShifts.map((shift) => (
                <tr key={shift.moduleName}>
                  <td>{shift.moduleName}</td>
                  <td>{shift.updatedBy || '?'}</td>
                  <td>{formatUpdatedAt(shift.updatedAt)}</td>
                  <td className="text-end">
                    <ButtonGroup size="sm">
                      <Button variant="outline-secondary" onClick={() => onLoad(shift.moduleName)}>
                        Load
                      </Button>
                      <Button
                        disabled={!canSaveCurrent || savingModuleName === shift.moduleName}
                        variant="outline-success"
                        onClick={() => onSave(shift.moduleName)}
                      >
                        {savingModuleName === shift.moduleName ? 'Saving…' : 'Save'}
                      </Button>
                    </ButtonGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
