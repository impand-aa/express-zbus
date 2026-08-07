import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Form, Modal, Row, Col, Stack } from 'react-bootstrap'

import type { ImportedRouteDefinition, JourneyOrderRow } from '../types'

interface CloneRouteOrdersModalProps {
  preferredRouteId: string | null
  routes: ImportedRouteDefinition[]
  show: boolean
  onClose: () => void
  onConfirm: (rows: JourneyOrderRow[]) => void
}

type CopyMode = 'all' | 'slice'

function describeRoute(route: ImportedRouteDefinition) {
  const lineDisplay = route.lineDisplay.kind === 'nil' ? 'nil' : route.lineDisplay.value || 'nil'
  return `${lineDisplay} | ${route.firstStopName || '?'} -> ${route.lastStopName || '?'} | ${route.orders.length} rows`
}

export function CloneRouteOrdersModal({
  preferredRouteId,
  routes,
  show,
  onClose,
  onConfirm,
}: CloneRouteOrdersModalProps) {
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [copyMode, setCopyMode] = useState<CopyMode>('all')
  const [startRow, setStartRow] = useState('1')
  const [endRow, setEndRow] = useState('1')

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) ?? null,
    [routes, selectedRouteId],
  )

  useEffect(() => {
    if (!show) {
      return
    }

    const defaultRouteId = routes.some((route) => route.id === preferredRouteId)
      ? preferredRouteId ?? ''
      : routes[0]?.id ?? ''
    const defaultRoute = routes.find((route) => route.id === defaultRouteId)

    setSelectedRouteId(defaultRouteId)
    setCopyMode('all')
    setStartRow('1')
    setEndRow(String(defaultRoute?.orders.length ?? 1))
  }, [preferredRouteId, routes, show])

  useEffect(() => {
    if (!show || !selectedRoute) {
      return
    }

    setStartRow('1')
    setEndRow(String(selectedRoute.orders.length || 1))
  }, [selectedRoute, show])

  const selectedRows = useMemo(() => {
    if (!selectedRoute) {
      return []
    }

    if (copyMode === 'all') {
      return selectedRoute.orders
    }

    const maxRow = selectedRoute.orders.length
    if (maxRow === 0) {
      return []
    }

    const rawStart = Number(startRow || 1)
    const rawEnd = Number(endRow || maxRow)
    const clampedStart = Math.min(Math.max(Math.floor(rawStart || 1), 1), maxRow)
    const clampedEnd = Math.min(Math.max(Math.floor(rawEnd || maxRow), clampedStart), maxRow)

    return selectedRoute.orders.slice(clampedStart - 1, clampedEnd)
  }, [copyMode, endRow, selectedRoute, startRow])

  return (
    <Modal centered show={show} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Clone route orders</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Stack gap={3} className="compact-form">
          {routes.length === 0 ? (
            <Alert variant="warning" className="mb-0 compact-alert">
              Import the Routes module first.
            </Alert>
          ) : null}

          <Form.Group>
            <Form.Label className="soft-label">Route</Form.Label>
            <Form.Select
              disabled={routes.length === 0}
              value={selectedRouteId}
              onChange={(event) => setSelectedRouteId(event.target.value)}
            >
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {describeRoute(route)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group>
            <Form.Label className="soft-label">Selection</Form.Label>
            <Stack gap={2}>
              <Form.Check
                checked={copyMode === 'all'}
                id="clone-route-orders-all"
                label="Copy all rows"
                name="clone-route-orders-mode"
                type="radio"
                onChange={() => setCopyMode('all')}
              />
              <Form.Check
                checked={copyMode === 'slice'}
                id="clone-route-orders-slice"
                label="Copy a row range"
                name="clone-route-orders-mode"
                type="radio"
                onChange={() => setCopyMode('slice')}
              />
            </Stack>
          </Form.Group>

          {copyMode === 'slice' ? (
            <Row className="g-2">
              <Col sm={6}>
                <Form.Group>
                  <Form.Label className="soft-label">Start row</Form.Label>
                  <Form.Control
                    min={1}
                    type="number"
                    value={startRow}
                    onChange={(event) => setStartRow(event.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col sm={6}>
                <Form.Group>
                  <Form.Label className="soft-label">End row</Form.Label>
                  <Form.Control
                    min={1}
                    type="number"
                    value={endRow}
                    onChange={(event) => setEndRow(event.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>
          ) : null}

          <div className="compact-card__hint">
            {selectedRoute
              ? `Selected ${selectedRows.length} row${selectedRows.length === 1 ? '' : 's'} from ${describeRoute(selectedRoute)}.`
              : 'No route selected.'}
          </div>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!selectedRoute || selectedRows.length === 0}
          variant="primary"
          onClick={() => onConfirm(selectedRows)}
        >
          Append rows
        </Button>
      </Modal.Footer>
    </Modal>
  )
}