import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Col, Form, Modal, Row, Stack } from 'react-bootstrap'

import { getIntegrityConfigIssue } from '../lib/integrity'
import type { IntegrityConfig } from '../lib/integrity'

interface IntegrityConfigModalProps {
  config: IntegrityConfig
  show: boolean
  warningCount: number
  onClose: () => void
  onSave: (nextConfig: IntegrityConfig) => void
}

export function IntegrityConfigModal({
  config,
  show,
  warningCount,
  onClose,
  onSave,
}: IntegrityConfigModalProps) {
  const [draftConfig, setDraftConfig] = useState(config)

  useEffect(() => {
    if (!show) {
      return
    }

    setDraftConfig(config)
  }, [config, show])

  const configIssue = useMemo(() => getIntegrityConfigIssue(draftConfig), [draftConfig])

  const addIntervalRange = () => {
    setDraftConfig((currentConfig) => ({
      ...currentConfig,
      intervalRanges: [
        ...currentConfig.intervalRanges,
        {
          enabled: true,
          maxMinutes: '',
          minMinutes: '',
          sameJourneyOnly: false,
        },
      ],
    }))
  }

  const removeIntervalRange = (rangeIndex: number) => {
    setDraftConfig((currentConfig) => ({
      ...currentConfig,
      intervalRanges: currentConfig.intervalRanges.filter((_, currentRangeIndex) => currentRangeIndex !== rangeIndex),
    }))
  }

  const updateIntervalRange = (rangeIndex: number, nextRange: Partial<IntegrityConfig['intervalRanges'][number]>) => {
    setDraftConfig((currentConfig) => ({
      ...currentConfig,
      intervalRanges: currentConfig.intervalRanges.map((range, currentRangeIndex) => (
        currentRangeIndex === rangeIndex ? { ...range, ...nextRange } : range
      )),
    }))
  }

  return (
    <Modal centered show={show} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Integrity configuration</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Stack gap={3} className="compact-form">
          <div className="integrity-config-note">
            Integrity checks review the current editor document and warn when configured conditions are not met.
            Pairs are compared only when stop, platform, line, and direction all match.
          </div>

          <Stack gap={2}>
            {draftConfig.intervalRanges.length === 0 ? (
              <div className="integrity-config-note">
                No allowed intervals configured yet.
              </div>
            ) : draftConfig.intervalRanges.map((range, rangeIndex) => (
              <div className="border rounded p-3" key={`interval-range-${rangeIndex}`}>
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                  <Form.Check
                    checked={range.enabled}
                    className="soft-label mb-0"
                    label={`Allowed interval ${rangeIndex + 1}`}
                    type="switch"
                    onChange={(event) => updateIntervalRange(rangeIndex, { enabled: event.target.checked })}
                  />

                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => removeIntervalRange(rangeIndex)}
                  >
                    Remove
                  </Button>
                </div>

                <Row className="g-2 align-items-end integrity-interval-card__grid">
                  <Form.Group as={Col} xs={6}>
                    <Form.Label className="soft-label integrity-interval-card__label">Minimum interval</Form.Label>
                    <Form.Control
                      size="sm"
                      placeholder="Optional"
                      type="number"
                      value={range.minMinutes}
                      onChange={(event) => updateIntervalRange(rangeIndex, { minMinutes: event.target.value })}
                    />
                  </Form.Group>

                  <Form.Group as={Col} xs={6}>
                    <Form.Label className="soft-label integrity-interval-card__label">Maximum interval</Form.Label>
                    <Form.Control
                      size="sm"
                      placeholder="Optional"
                      type="number"
                      value={range.maxMinutes}
                      onChange={(event) => updateIntervalRange(rangeIndex, { maxMinutes: event.target.value })}
                    />
                  </Form.Group>

                  <Col xs={12}>
                    <Form.Check
                      checked={range.sameJourneyOnly}
                      className="soft-label integrity-interval-card__scope"
                      label="Only compare pairs from the same journey"
                      type="switch"
                      onChange={(event) => updateIntervalRange(rangeIndex, { sameJourneyOnly: event.target.checked })}
                    />
                  </Col>
                </Row>
              </div>
            ))}

            <div>
              <Button size="sm" variant="outline-secondary" onClick={addIntervalRange}>
                Add allowed interval
              </Button>
            </div>
          </Stack>

          <Form.Text className="text-muted">
            A departure gap is accepted if it matches any enabled interval above.
            Use exact values by setting the same minimum and maximum, such as 5 and 5.
          </Form.Text>

          <div className="integrity-config-note">
            Current warnings: {warningCount}
          </div>

          {configIssue ? (
            <Alert variant="warning" className="mb-0 compact-alert">
              {configIssue}
            </Alert>
          ) : null}
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={Boolean(configIssue)} variant="primary" onClick={() => onSave(draftConfig)}>
          Save checks
        </Button>
      </Modal.Footer>
    </Modal>
  )
}