import type { Dispatch, SetStateAction } from 'react'
import { Alert, Badge, Button, ButtonGroup, Card, Col, Form, Row, Stack } from 'react-bootstrap'

import {
  createTemporaryNumDisplayFrame,
  createTemporaryNumEntry,
  createTemporaryPanelEntry,
  createTemporaryPanelFrame,
  type TemporaryColorMode,
  type TemporaryColorValue,
  type TemporaryNumDisplayFrame,
  type TemporaryNumEntry,
  type TemporaryNumVariant,
  type TemporaryPanelEntry,
  type TemporaryPanelFrame,
  type TemporaryPanelNumValue,
  type TemporaryPanelNumsMode,
  type TemporaryPanelVariant,
} from '../lib/temporaryDisplayUpdate'

interface TemporaryDisplaysTabProps {
  hasImportedNumTemplates: boolean
  hasImportedPanelTemplates: boolean
  liveUpdateError: string
  liveUpdateReady: boolean
  numEntries: TemporaryNumEntry[]
  panelEntries: TemporaryPanelEntry[]
  onImportNumById: (entryId: string) => void
  onImportPanelById: (entryId: string) => void
  onChangeNumEntries: Dispatch<SetStateAction<TemporaryNumEntry[]>>
  onChangePanelEntries: Dispatch<SetStateAction<TemporaryPanelEntry[]>>
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
  allowAuto = false,
  label,
  value,
  onChange,
}: {
  allowAuto?: boolean
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
            mode: event.target.value as TemporaryColorMode,
          })}
        >
          <option value="none">None</option>
          <option value="rgb">Colour</option>
          {allowAuto ? <option value="auto">Auto</option> : null}
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

function PanelNumValueEditor({
  label,
  value,
  onChange,
}: {
  label: string
  value: TemporaryPanelNumValue
  onChange: (value: TemporaryPanelNumValue) => void
}) {
  return (
    <Form.Group>
      <Form.Label className="soft-label">{label}</Form.Label>
      <div className="temporary-display-inline-row">
        <Form.Select
          size="sm"
          value={value.mode}
          onChange={(event) => onChange({
            ...value,
            mode: event.target.value as TemporaryPanelNumValue['mode'],
          })}
        >
          <option value="empty">None</option>
          <option value="text">Value</option>
          <option value="false">False</option>
        </Form.Select>
        <Form.Control
          size="sm"
          placeholder="Text or asset id"
          disabled={value.mode !== 'text'}
          value={value.value}
          onChange={(event) => onChange({
            ...value,
            value: event.target.value,
          })}
        />
      </div>
    </Form.Group>
  )
}

function PanelFrameEditor({
  allowAutoAllColors = false,
  frame,
  onChange,
  onRemove,
  removable = true,
  title,
}: {
  allowAutoAllColors?: boolean
  frame: TemporaryPanelFrame
  onChange: (frame: TemporaryPanelFrame) => void
  onRemove?: () => void
  removable?: boolean
  title: string
}) {
  return (
    <div className="temporary-display-frame-card">
      <div className="panel-toolbar panel-toolbar--dense mb-2">
        <div className="panel-label">{title}</div>
        {removable && onRemove ? (
          <Button size="sm" variant="outline-danger" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>

      <Row className="g-2">
        <Col xl={6}>
          <Form.Group>
            <Form.Label className="soft-label">Head</Form.Label>
            <Form.Control
              size="sm"
              placeholder="Blank becomes nil"
              value={frame.head}
              onChange={(event) => onChange({ ...frame, head: event.target.value })}
            />
          </Form.Group>
        </Col>
        <Col xl={6}>
          <Form.Group>
            <Form.Label className="soft-label">Foot</Form.Label>
            <Form.Control
              size="sm"
              placeholder="Blank becomes nil"
              value={frame.foot}
              onChange={(event) => onChange({ ...frame, foot: event.target.value })}
            />
          </Form.Group>
        </Col>
        <Col xl={6}>
          <PanelNumValueEditor
            label="Num"
            value={frame.num}
            onChange={(value) => onChange({ ...frame, num: value })}
          />
        </Col>
      </Row>

      <div className="temporary-display-color-grid mt-2">
        <ColorValueEditor allowAuto={allowAutoAllColors} label="Head colour" value={frame.headColor} onChange={(value) => onChange({ ...frame, headColor: value })} />
        <ColorValueEditor allowAuto={allowAutoAllColors} label="Head background" value={frame.headBgColor} onChange={(value) => onChange({ ...frame, headBgColor: value })} />
        <ColorValueEditor allowAuto={allowAutoAllColors} label="Foot colour" value={frame.footColor} onChange={(value) => onChange({ ...frame, footColor: value })} />
        <ColorValueEditor allowAuto={allowAutoAllColors} label="Foot background" value={frame.footBgColor} onChange={(value) => onChange({ ...frame, footBgColor: value })} />
        <ColorValueEditor allowAuto={allowAutoAllColors || true} label="Num colour" value={frame.numColor} onChange={(value) => onChange({ ...frame, numColor: value })} />
        <ColorValueEditor allowAuto={allowAutoAllColors} label="Num background" value={frame.numBgColor} onChange={(value) => onChange({ ...frame, numBgColor: value })} />
      </div>
    </div>
  )
}

function NumDisplayFrameEditor({
  allowAutoAllColors = false,
  frame,
  onChange,
  onRemove,
}: {
  allowAutoAllColors?: boolean
  frame: TemporaryNumDisplayFrame
  onChange: (frame: TemporaryNumDisplayFrame) => void
  onRemove: () => void
}) {
  return (
    <div className="temporary-display-frame-card">
      <div className="panel-toolbar panel-toolbar--dense mb-2">
        <div className="panel-label">Num display frame</div>
        <Button size="sm" variant="outline-danger" onClick={onRemove}>
          Remove
        </Button>
      </div>

      <Row className="g-2">
        <Col xl={6}>
          <PanelNumValueEditor
            label="Num"
            value={frame.num}
            onChange={(value) => onChange({ ...frame, num: value })}
          />
        </Col>
      </Row>

      <div className="temporary-display-color-grid mt-2">
        <ColorValueEditor allowAuto label="Num colour" value={frame.numColor} onChange={(value) => onChange({ ...frame, numColor: value })} />
        <ColorValueEditor allowAuto={allowAutoAllColors} label="Num background" value={frame.numBgColor} onChange={(value) => onChange({ ...frame, numBgColor: value })} />
      </div>
    </div>
  )
}

function PanelVariantEditor({
  allowAutoAllColors = false,
  title,
  value,
  onChange,
}: {
  allowAutoAllColors?: boolean
  title: string
  value: TemporaryPanelVariant
  onChange: (value: TemporaryPanelVariant) => void
}) {
  return (
    <Card className="temporary-display-variant-card border-0">
      <Card.Body className="p-3">
        <Stack gap={3} className="compact-form">
          <div className="panel-toolbar panel-toolbar--dense">
            <div className="panel-label">{title}</div>
          </div>

          <div>
            <div className="panel-toolbar panel-toolbar--dense">
              <div className="panel-label">Front frames</div>
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => onChange({
                  ...value,
                  frontFrames: [...value.frontFrames, createTemporaryPanelFrame()],
                })}
              >
                Add front frame
              </Button>
            </div>

            <Stack gap={2}>
              {value.frontFrames.map((frame, index) => (
                <PanelFrameEditor
                  key={frame.id}
                  allowAutoAllColors={allowAutoAllColors}
                  frame={frame}
                  removable={value.frontFrames.length > 1}
                  title={`Front frame ${index + 1}`}
                  onChange={(nextFrame) => onChange({
                    ...value,
                    frontFrames: updateEntityById(value.frontFrames, frame.id, () => nextFrame),
                  })}
                  onRemove={() => onChange({
                    ...value,
                    frontFrames: removeEntityById(value.frontFrames, frame.id),
                  })}
                />
              ))}
            </Stack>
          </div>

          <div>
            <div className="panel-toolbar panel-toolbar--dense">
              <div className="panel-label">Side frames</div>
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => onChange({
                  ...value,
                  sideFrames: [...value.sideFrames, createTemporaryPanelFrame()],
                })}
              >
                Add side frame
              </Button>
            </div>

            {value.sideFrames.length === 0 ? (
              <div className="temporary-display-empty-note">No side frames. Leave empty to omit the Side block.</div>
            ) : (
              <Stack gap={2}>
                {value.sideFrames.map((frame, index) => (
                  <PanelFrameEditor
                    key={frame.id}
                    allowAutoAllColors={allowAutoAllColors}
                    frame={frame}
                    title={`Side frame ${index + 1}`}
                    onChange={(nextFrame) => onChange({
                      ...value,
                      sideFrames: updateEntityById(value.sideFrames, frame.id, () => nextFrame),
                    })}
                    onRemove={() => onChange({
                      ...value,
                      sideFrames: removeEntityById(value.sideFrames, frame.id),
                    })}
                  />
                ))}
              </Stack>
            )}
          </div>

          <div>
            <Form.Group>
              <Form.Label className="soft-label">Nums display block</Form.Label>
              <Form.Select
                size="sm"
                value={value.numsMode}
                onChange={(event) => onChange({
                  ...value,
                  numsMode: event.target.value as TemporaryPanelNumsMode,
                })}
              >
                <option value="omit">Omit</option>
                <option value="false">False</option>
                <option value="frames">Frames</option>
              </Form.Select>
            </Form.Group>

            {value.numsMode === 'frames' ? (
              <>
                <div className="panel-toolbar panel-toolbar--dense mt-2">
                  <div className="panel-label">Num display frames</div>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => onChange({
                      ...value,
                      numsFrames: [...value.numsFrames, createTemporaryNumDisplayFrame()],
                    })}
                  >
                    Add num frame
                  </Button>
                </div>

                {value.numsFrames.length === 0 ? (
                  <div className="temporary-display-empty-note">At least one num display frame is required when this block is enabled.</div>
                ) : (
                  <Stack gap={2} className="mt-2">
                    {value.numsFrames.map((frame) => (
                      <NumDisplayFrameEditor
                        allowAutoAllColors={allowAutoAllColors}
                        key={frame.id}
                        frame={frame}
                        onChange={(nextFrame) => onChange({
                          ...value,
                          numsFrames: updateEntityById(value.numsFrames, frame.id, () => nextFrame),
                        })}
                        onRemove={() => onChange({
                          ...value,
                          numsFrames: removeEntityById(value.numsFrames, frame.id),
                        })}
                      />
                    ))}
                  </Stack>
                )}
              </>
            ) : null}
          </div>
        </Stack>
      </Card.Body>
    </Card>
  )
}

function NumVariantEditor({
  allowAutoAllColors = false,
  title,
  value,
  onChange,
}: {
  allowAutoAllColors?: boolean
  title: string
  value: TemporaryNumVariant
  onChange: (value: TemporaryNumVariant) => void
}) {
  return (
    <Card className="temporary-display-variant-card border-0">
      <Card.Body className="p-3">
        <Stack gap={3} className="compact-form">
          <div className="panel-label">{title}</div>

          <Form.Group>
            <Form.Label className="soft-label">Num</Form.Label>
            <Form.Control
              size="sm"
              placeholder="Text, x47, or asset id"
              value={value.num}
              onChange={(event) => onChange({
                ...value,
                num: event.target.value,
              })}
            />
          </Form.Group>

          <div className="temporary-display-color-grid">
            <ColorValueEditor allowAuto label="Num colour" value={value.numColor} onChange={(nextValue) => onChange({ ...value, numColor: nextValue })} />
            <ColorValueEditor allowAuto={allowAutoAllColors} label="Num background" value={value.numBgColor} onChange={(nextValue) => onChange({ ...value, numBgColor: nextValue })} />
          </div>
        </Stack>
      </Card.Body>
    </Card>
  )
}

export function TemporaryDisplaysTab({
  hasImportedNumTemplates,
  hasImportedPanelTemplates,
  liveUpdateError,
  liveUpdateReady,
  numEntries,
  panelEntries,
  onImportNumById,
  onImportPanelById,
  onChangeNumEntries,
  onChangePanelEntries,
  onClearAll,
  onOpenLiveUpdate,
}: TemporaryDisplaysTabProps) {
  return (
    <Card className="workspace-panel border-0 code-panel temporary-displays-tab">
      <Card.Body className="p-3 p-xl-3">
        <div className="temporary-displays-tab__header">
          <div>
            <div className="panel-label">Temporary display editor</div>
            <div className="temporary-displays-tab__note">
              Build temporary Panels and Nums entries here, then generate one live update snippet that patches both Color and Mono variants in memory only. Nothing on this tab is saved to local storage.
            </div>
            <div className="temporary-displays-tab__note my-4">
                Change to tbus/bus: <code>[rbxassetid://17709252969] [rbxassetid://10804592292] [47] . FABRIKY</code><br/>
                Change to tram: <code>rbxassetid://17709252969 rbxassetid://7133172901 [1] . STN. LIPKOV</code><br/>
                Arrow character: <code>▶</code><br/>
                Invert yellow bg colour: <code>FFB400</code> (<code>255, 180, 0</code>)<br/>
                Sub orange bg colour: <code>FF7300</code> (<code>255, 115, 0</code>)<br/>
            </div>
            <div className="temporary-displays-tab__note">
              Use the entry ID fields with the import buttons below to pull all current values from the loaded Panels and Nums reference sources. Imported source values are used as the starting point for both temporary variants.
            </div>
          </div>

          <ButtonGroup size="sm">
            <Button variant="outline-secondary" onClick={() => onChangePanelEntries((current) => [...current, createTemporaryPanelEntry()])}>
              Add panel
            </Button>
            <Button variant="outline-secondary" onClick={() => onChangeNumEntries((current) => [...current, createTemporaryNumEntry()])}>
              Add num
            </Button>
            <Button variant="outline-secondary" onClick={onClearAll}>
              Clear all
            </Button>
            <Button disabled={!liveUpdateReady && panelEntries.length === 0 && numEntries.length === 0} variant="primary" onClick={onOpenLiveUpdate}>
              Live update
            </Button>
          </ButtonGroup>
        </div>

        <div className="temporary-displays-tab__stats">
          <Badge bg="secondary" pill>{panelEntries.length} panel entr{panelEntries.length === 1 ? 'y' : 'ies'}</Badge>
          <Badge bg="secondary" pill>{numEntries.length} num entr{numEntries.length === 1 ? 'y' : 'ies'}</Badge>
        </div>

        {liveUpdateError ? (
          <Alert variant="warning" className="mt-3 mb-0 compact-alert">
            {liveUpdateError}
          </Alert>
        ) : null}

        <Row className="g-3 mt-1">
          <Col xl={8}>
            <Stack gap={3}>
              <div className="panel-toolbar panel-toolbar--dense mb-0">
                <div className="panel-label">Panels</div>
              </div>

              {panelEntries.length === 0 ? (
                <Alert variant="light" className="mb-0 compact-alert">
                  No temporary panel entries yet.
                </Alert>
              ) : (
                <Stack gap={3}>
                  {panelEntries.map((entry, index) => (
                    <Card className="temporary-display-entry-card border-0" key={entry.id}>
                      <Card.Body className="p-3">
                        <Stack gap={3} className="compact-form">
                          <div className="panel-toolbar panel-toolbar--dense mb-0">
                            <div>
                              <div className="panel-label">Panel entry {index + 1}</div>
                              <div className="temporary-display-entry-summary">
                                {entry.panelId.trim() || 'No panel ID'} · {entry.destination.trim() || 'No destination'}
                              </div>
                            </div>
                            <Button size="sm" variant="outline-danger" onClick={() => onChangePanelEntries((current) => removeEntityById(current, entry.id))}>
                              Remove panel
                            </Button>
                          </div>

                          <Row className="g-2">
                            <Col md={4}>
                              <Form.Group>
                                <Form.Label className="soft-label">Panel ID</Form.Label>
                                <div className="temporary-display-inline-row">
                                  <Form.Control
                                    size="sm"
                                    placeholder="e.g. 950"
                                    value={entry.panelId}
                                    onChange={(event) => onChangePanelEntries((current) => updateEntityById(current, entry.id, (item) => ({
                                      ...item,
                                      panelId: event.target.value,
                                    })))}
                                  />
                                  <Button disabled={!hasImportedPanelTemplates} size="sm" variant="outline-secondary" onClick={() => onImportPanelById(entry.id)}>
                                    Import ID
                                  </Button>
                                </div>
                              </Form.Group>
                            </Col>
                            <Col md={4}>
                              <Form.Group>
                                <Form.Label className="soft-label">Destination</Form.Label>
                                <Form.Control
                                  size="sm"
                                  placeholder="Blank becomes nil"
                                  value={entry.destination}
                                  onChange={(event) => onChangePanelEntries((current) => updateEntityById(current, entry.id, (item) => ({
                                    ...item,
                                    destination: event.target.value,
                                  })))}
                                />
                              </Form.Group>
                            </Col>
                            <Col md={4}>
                              <Form.Group>
                                <Form.Label className="soft-label">Via</Form.Label>
                                <Form.Control
                                  size="sm"
                                  placeholder="Blank becomes nil"
                                  value={entry.via}
                                  onChange={(event) => onChangePanelEntries((current) => updateEntityById(current, entry.id, (item) => ({
                                    ...item,
                                    via: event.target.value,
                                  })))}
                                />
                              </Form.Group>
                            </Col>
                          </Row>

                          <Row className="g-3">
                            <Col xl={6}>
                              <PanelVariantEditor
                                title="Color variant"
                                value={entry.color}
                                onChange={(value) => onChangePanelEntries((current) => updateEntityById(current, entry.id, (item) => ({
                                  ...item,
                                  color: value,
                                })))}
                              />
                            </Col>
                            <Col xl={6}>
                              <PanelVariantEditor
                                allowAutoAllColors
                                title="Mono variant"
                                value={entry.mono}
                                onChange={(value) => onChangePanelEntries((current) => updateEntityById(current, entry.id, (item) => ({
                                  ...item,
                                  mono: value,
                                })))}
                              />
                            </Col>
                          </Row>
                        </Stack>
                      </Card.Body>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>
          </Col>

          <Col xl={4}>
            <Stack gap={3}>
              <div className="panel-toolbar panel-toolbar--dense mb-0">
                <div className="panel-label">Nums</div>
              </div>

              {numEntries.length === 0 ? (
                <Alert variant="light" className="mb-0 compact-alert">
                  No temporary num entries yet.
                </Alert>
              ) : (
                <Stack gap={3}>
                  {numEntries.map((entry, index) => (
                    <Card className="temporary-display-entry-card border-0" key={entry.id}>
                      <Card.Body className="p-3">
                        <Stack gap={3} className="compact-form">
                          <div className="panel-toolbar panel-toolbar--dense mb-0">
                            <div>
                              <div className="panel-label">Num entry {index + 1}</div>
                              <div className="temporary-display-entry-summary">{entry.numId.trim() || 'No num ID'}</div>
                            </div>
                            <Button size="sm" variant="outline-danger" onClick={() => onChangeNumEntries((current) => removeEntityById(current, entry.id))}>
                              Remove num
                            </Button>
                          </div>

                          <Form.Group>
                            <Form.Label className="soft-label">Num ID</Form.Label>
                            <div className="temporary-display-inline-row">
                              <Form.Control
                                size="sm"
                                placeholder="e.g. 950"
                                value={entry.numId}
                                onChange={(event) => onChangeNumEntries((current) => updateEntityById(current, entry.id, (item) => ({
                                  ...item,
                                  numId: event.target.value,
                                })))}
                              />
                              <Button disabled={!hasImportedNumTemplates} size="sm" variant="outline-secondary" onClick={() => onImportNumById(entry.id)}>
                                Import ID
                              </Button>
                            </div>
                          </Form.Group>

                          <NumVariantEditor
                            title="Color variant"
                            value={entry.color}
                            onChange={(value) => onChangeNumEntries((current) => updateEntityById(current, entry.id, (item) => ({
                              ...item,
                              color: value,
                            })))}
                          />

                          <NumVariantEditor
                            allowAutoAllColors
                            title="Mono variant"
                            value={entry.mono}
                            onChange={(value) => onChangeNumEntries((current) => updateEntityById(current, entry.id, (item) => ({
                              ...item,
                              mono: value,
                            })))}
                          />
                        </Stack>
                      </Card.Body>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  )
}