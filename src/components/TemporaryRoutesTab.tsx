import type { Dispatch, SetStateAction } from 'react'
import { Alert, Badge, Button, ButtonGroup, Card, Col, Form, Row, Stack } from 'react-bootstrap'

import { createTemporaryRouteEntry, type TemporaryRouteEntry } from '../lib/temporaryRouteUpdate'
import type { TemporaryColorMode, TemporaryColorValue } from '../lib/temporaryDisplayUpdate'

interface TemporaryRoutesTabProps {
  liveUpdateError: string
  liveUpdateReady: boolean
  routeEntries: TemporaryRouteEntry[]
  onChangeRouteEntries: Dispatch<SetStateAction<TemporaryRouteEntry[]>>
  onClearAll: () => void
  onOpenLiveUpdate: () => void
}

function updateEntityById<T extends { id: string }>(items: T[], id: string, updater: (item: T) => T) {
  return items.map((item) => (item.id === id ? updater(item) : item))
}

function removeEntityById<T extends { id: string }>(items: T[], id: string) {
  return items.filter((item) => item.id !== id)
}

function ColorValueEditor({
  label,
  value,
  onChange,
}: {
  label: string
  value: TemporaryColorValue
  onChange: (value: TemporaryColorValue) => void
}) {
  return (
    <Form.Group>
      <Form.Label className="soft-label">{label}</Form.Label>
      <div className="temporary-display-color-row">
        <Form.Select
          size="sm"
          value={value.mode}
          onChange={(event) => onChange({
            ...value,
            mode: event.target.value as Exclude<TemporaryColorMode, 'auto'>,
          })}
        >
          <option value="none">None</option>
          <option value="rgb">Colour</option>
        </Form.Select>
        <Form.Control
          size="sm"
          type="color"
          value={value.hex}
          disabled={value.mode !== 'rgb'}
          onChange={(event) => onChange({
            ...value,
            hex: event.target.value,
          })}
        />
        <div
          className={`temporary-display-color-swatch${value.mode === 'rgb' ? ' is-active' : ''}`}
          style={{ backgroundColor: value.mode === 'rgb' ? value.hex : 'transparent' }}
        />
      </div>
    </Form.Group>
  )
}

export function TemporaryRoutesTab({
  liveUpdateError,
  liveUpdateReady,
  routeEntries,
  onChangeRouteEntries,
  onClearAll,
  onOpenLiveUpdate,
}: TemporaryRoutesTabProps) {
  return (
    <Card className="workspace-panel border-0 code-panel temporary-displays-tab">
      <Card.Body className="p-3 p-xl-3">
        <div className="temporary-displays-tab__header">
          <div>
            <div className="panel-label">Temporary route editor</div>
            <div className="temporary-displays-tab__note">
              Build temporary route definitions here. Live update exports append them to the Routes module with fixed <code>{'{"panel", 910}'}</code> order and <code>{'{}'}</code> groups only.
            </div>
          </div>

          <ButtonGroup size="sm">
            <Button variant="outline-secondary" onClick={() => onChangeRouteEntries((current) => [...current, createTemporaryRouteEntry()])}>
              Add route
            </Button>
            <Button variant="outline-secondary" onClick={onClearAll}>
              Clear all
            </Button>
            <Button disabled={!liveUpdateReady && routeEntries.length === 0} variant="primary" onClick={onOpenLiveUpdate}>
              Live update
            </Button>
          </ButtonGroup>
        </div>

        <div className="temporary-displays-tab__stats">
          <Badge bg="secondary" pill>{routeEntries.length} route entr{routeEntries.length === 1 ? 'y' : 'ies'}</Badge>
        </div>

        {liveUpdateError ? (
          <Alert variant="warning" className="mt-3 mb-0 compact-alert">
            {liveUpdateError}
          </Alert>
        ) : null}

        <Stack className="mt-3" gap={3}>
          {routeEntries.length === 0 ? (
            <Alert variant="light" className="mb-0 compact-alert">
              No temporary route entries yet.
            </Alert>
          ) : routeEntries.map((entry, index) => (
            <Card className="temporary-display-entry-card border-0" key={entry.id}>
              <Card.Body className="p-3">
                <Stack gap={3} className="compact-form">
                  <div className="panel-toolbar panel-toolbar--dense mb-0">
                    <div>
                      <div className="panel-label">Route entry {index + 1}</div>
                      <div className="temporary-display-entry-summary">{entry.lineDisplay.trim() || 'nil'} · LineNum {entry.lineNum.trim() || 'nil'}</div>
                    </div>
                    <Button size="sm" variant="outline-danger" onClick={() => onChangeRouteEntries((current) => removeEntityById(current, entry.id))}>
                      Remove route
                    </Button>
                  </div>

                  <Row className="g-2">
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="soft-label">LineDisplay</Form.Label>
                        <Form.Control
                          size="sm"
                          placeholder="Blank becomes nil"
                          value={entry.lineDisplay}
                          onChange={(event) => onChangeRouteEntries((current) => updateEntityById(current, entry.id, (item) => ({
                            ...item,
                            lineDisplay: event.target.value,
                          })))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="soft-label">LineNum</Form.Label>
                        <Form.Control
                          size="sm"
                          placeholder="Optional num id"
                          value={entry.lineNum}
                          onChange={(event) => onChangeRouteEntries((current) => updateEntityById(current, entry.id, (item) => ({
                            ...item,
                            lineNum: event.target.value,
                          })))}
                        />
                        <Form.Text className="text-secondary">
                          When defined, this points to the Num ID used by the route.
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>

                  <div className="temporary-display-color-grid">
                    <ColorValueEditor
                      label="Line colour"
                      value={entry.lineDisplayColor}
                      onChange={(value) => onChangeRouteEntries((current) => updateEntityById(current, entry.id, (item) => ({
                        ...item,
                        lineDisplayColor: value,
                      })))}
                    />
                    <ColorValueEditor
                      label="Line background"
                      value={entry.lineDisplayBgColor}
                      onChange={(value) => onChangeRouteEntries((current) => updateEntityById(current, entry.id, (item) => ({
                        ...item,
                        lineDisplayBgColor: value,
                      })))}
                    />
                  </div>

                  <Alert variant="light" className="mb-0 compact-alert">
                    Live update will export this route with only <code>{'{"panel", 910}'}</code> in Orders. Build the actual schedule in the main shift editor.
                  </Alert>
                </Stack>
              </Card.Body>
            </Card>
          ))}
        </Stack>
      </Card.Body>
    </Card>
  )
}