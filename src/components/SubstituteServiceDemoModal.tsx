import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Col, Form, Modal, Row, Stack } from 'react-bootstrap'

import { parseShiftModuleSource } from '../lib/luauShift'
import {
  appendSubstituteServicePlan,
  buildSubstituteServicePlannerPreview,
  getTemplateInterchangeOptions,
  type AppendedSubstituteServicePlan,
  type PlannedJourneyChange,
  type SubstitutePlannerJourneyOption,
  type SubstituteServicePreviewStatus,
} from '../lib/substituteServicePlanner'
import type { ImportedRouteDefinition, JourneyDefinition, ShiftOrder } from '../types'

// Substitute duties are appended as new shift orders and labelled A–Z, so the
// only meaningful upper bound is the number of available duty letters.
const MAX_SUBSTITUTE_DUTIES = 26

interface DutyTemplateConfig {
  firstJourneyId: string
  interchangeKey: string
  secondJourneyId: string
}

interface SubstituteServicePlannerModalProps {
  importedRoutes: ImportedRouteDefinition[]
  journeys: JourneyDefinition[]
  onCommitPlan: (plan: AppendedSubstituteServicePlan) => void
  selectedJourneyId: string | null
  shiftOrders: ShiftOrder[]
  show: boolean
  onClose: () => void
}

function createDefaultTemplate(index: number, journeyOptions: SubstitutePlannerJourneyOption[], selectedJourneyId: string | null): DutyTemplateConfig {
  if (journeyOptions.length === 0) {
    return {
      firstJourneyId: '',
      interchangeKey: '',
      secondJourneyId: '',
    }
  }

  const primaryJourneyId = selectedJourneyId && journeyOptions.some((journeyOption) => journeyOption.id === selectedJourneyId)
    ? selectedJourneyId
    : journeyOptions[index % journeyOptions.length]?.id ?? journeyOptions[0]?.id ?? ''
  const secondaryJourneyId = journeyOptions.find((journeyOption) => journeyOption.id !== primaryJourneyId)?.id ?? primaryJourneyId

  return {
    firstJourneyId: primaryJourneyId,
    interchangeKey: '',
    secondJourneyId: secondaryJourneyId,
  }
}

function getStatusVariant(status: SubstituteServicePreviewStatus) {
  if (status === 'impossible') {
    return 'danger'
  }

  if (status === 'warning') {
    return 'warning'
  }

  return 'success'
}

function getBreakRangeLabel(breakMinutes: Array<number | null>) {
  const resolvedBreakMinutes = breakMinutes.filter((value): value is number => value !== null)
  if (resolvedBreakMinutes.length === 0) {
    return 'n/a'
  }

  const minBreakMinutes = Math.min(...resolvedBreakMinutes)
  const maxBreakMinutes = Math.max(...resolvedBreakMinutes)

  return minBreakMinutes === maxBreakMinutes
    ? `${minBreakMinutes} min`
    : `${minBreakMinutes}-${maxBreakMinutes} min`
}

function formatPauseLabel(value: string) {
  return value.trim() ? `${value} min` : 'none'
}

function describeJourneyChange(change: PlannedJourneyChange) {
  if (change.kind === 'reference-import') {
    return `Add reference journey ${change.sourceJourneyKey} as ${change.resultingJourneyKey} in the current shift.`
  }

  if (change.kind === 'current-retime') {
    return `${change.dutyLabel ?? 'Planner'} will update the existing journey ${change.sourceJourneyKey} and change its pause before journey from ${formatPauseLabel(change.pauseBeforeJourneyBefore)} to ${formatPauseLabel(change.pauseBeforeJourneyAfter)}.`
  }

  if (change.kind === 'loop-retimed-clone') {
    return `${change.dutyLabel ?? 'Planner'} will clone ${change.sourceJourneyKey} as ${change.resultingJourneyKey} and change its pause before journey from ${formatPauseLabel(change.pauseBeforeJourneyBefore)} to ${formatPauseLabel(change.pauseBeforeJourneyAfter)}.`
  }

  return `${change.dutyLabel ?? 'Planner'} will clone ${change.sourceJourneyKey} as ${change.resultingJourneyKey} without changing its pause before journey.`
}

function renderJourneyOptions(currentJourneyOptions: SubstitutePlannerJourneyOption[], referenceJourneyOptions: SubstitutePlannerJourneyOption[]) {
  return (
    <>
      {currentJourneyOptions.length > 0 ? (
        <optgroup label="Current substitute shift">
          {currentJourneyOptions.map((journeyOption) => (
            <option key={journeyOption.id} value={journeyOption.id}>
              {journeyOption.journey.key} | {journeyOption.journey.from || '*'} {'->'} {journeyOption.journey.to || '*'}
            </option>
          ))}
        </optgroup>
      ) : null}
      {referenceJourneyOptions.length > 0 ? (
        <optgroup label="Reference base shift">
          {referenceJourneyOptions.map((journeyOption) => (
            <option key={journeyOption.id} value={journeyOption.id}>
              {journeyOption.journey.key} | {journeyOption.journey.from || '*'} {'->'} {journeyOption.journey.to || '*'}
            </option>
          ))}
        </optgroup>
      ) : null}
    </>
  )
}

export function SubstituteServicePlannerModal({
  importedRoutes,
  journeys,
  onCommitPlan,
  selectedJourneyId,
  shiftOrders,
  show,
  onClose,
}: SubstituteServicePlannerModalProps) {
  const [dutyCount, setDutyCount] = useState('2')
  const [minBreakMinutes, setMinBreakMinutes] = useState('3')
  const [maxDesiredBreakMinutes, setMaxDesiredBreakMinutes] = useState('8')
  const [referenceShiftSource, setReferenceShiftSource] = useState('')
  const [templates, setTemplates] = useState<DutyTemplateConfig[]>([])

  const maxDutyCount = MAX_SUBSTITUTE_DUTIES
  const parsedDutyCount = Math.min(Math.max(Math.floor(Number(dutyCount || 0)) || 1, 1), maxDutyCount)

  const referenceShiftState = useMemo(() => {
    if (!referenceShiftSource.trim()) {
      return {
        document: null,
        error: '',
      }
    }

    try {
      return {
        document: parseShiftModuleSource(referenceShiftSource),
        error: '',
      }
    } catch (error) {
      return {
        document: null,
        error: error instanceof Error ? error.message : 'Could not parse the reference base shift source.',
      }
    }
  }, [referenceShiftSource])

  const currentJourneyOptions = useMemo(() => (
    journeys.map((journey) => ({
      id: journey.id,
      journey,
      source: 'current' as const,
    }))
  ), [journeys])

  const referenceJourneyOptions = useMemo(() => (
    (referenceShiftState.document?.journeys ?? []).map((journey) => ({
      id: journey.id,
      journey,
      source: 'reference' as const,
    }))
  ), [referenceShiftState.document])

  const availableJourneyOptions = useMemo(() => ([...currentJourneyOptions, ...referenceJourneyOptions]), [currentJourneyOptions, referenceJourneyOptions])
  const availableTemplateJourneys = useMemo(() => availableJourneyOptions.map((journeyOption) => journeyOption.journey), [availableJourneyOptions])
  const availableJourneyIds = useMemo(() => new Set(availableJourneyOptions.map((journeyOption) => journeyOption.id)), [availableJourneyOptions])
  const commitTemplates = useMemo(() => templates.slice(0, parsedDutyCount).map((template, index) => ({
    dutyLabel: `Duty ${String.fromCharCode(65 + index)}`,
    interchangeKey: template.interchangeKey,
    journeyIds: [template.firstJourneyId, template.secondJourneyId].filter(Boolean),
  })), [parsedDutyCount, templates])

  function normalizeTemplate(template: DutyTemplateConfig, fallbackIndex: number) {
    const fallbackTemplate = createDefaultTemplate(fallbackIndex, availableJourneyOptions, selectedJourneyId)
    const nextTemplate = {
      firstJourneyId: availableJourneyIds.has(template.firstJourneyId)
        ? template.firstJourneyId
        : fallbackTemplate.firstJourneyId,
      interchangeKey: template.interchangeKey,
      secondJourneyId: availableJourneyIds.has(template.secondJourneyId)
        ? template.secondJourneyId
        : fallbackTemplate.secondJourneyId,
    }
    const interchangeOptions = getTemplateInterchangeOptions(
      [nextTemplate.firstJourneyId, nextTemplate.secondJourneyId].filter(Boolean),
      availableTemplateJourneys,
      importedRoutes,
    )
    const resolvedInterchangeKey = interchangeOptions.some((option) => option.key === nextTemplate.interchangeKey)
      ? nextTemplate.interchangeKey
      : (interchangeOptions[0]?.key ?? '')

    return {
      ...nextTemplate,
      interchangeKey: resolvedInterchangeKey,
    }
  }

  useEffect(() => {
    if (!show) {
      return
    }

    const defaultDutyCount = Math.min(2, maxDutyCount)
    setDutyCount(String(defaultDutyCount))
    setMinBreakMinutes('3')
    setMaxDesiredBreakMinutes('8')
    setReferenceShiftSource('')
    setTemplates(Array.from({ length: defaultDutyCount }, (_, index) => normalizeTemplate(
      createDefaultTemplate(index, currentJourneyOptions, selectedJourneyId),
      index,
    )))
  }, [currentJourneyOptions, importedRoutes, maxDutyCount, selectedJourneyId, show])

  useEffect(() => {
    setTemplates((currentTemplates) => {
      const nextTemplates = currentTemplates.slice(0, parsedDutyCount).map((currentTemplate, index) => normalizeTemplate(currentTemplate, index))

      while (nextTemplates.length < parsedDutyCount) {
        nextTemplates.push(normalizeTemplate(createDefaultTemplate(nextTemplates.length, availableJourneyOptions, selectedJourneyId), nextTemplates.length))
      }

      return nextTemplates
    })
  }, [availableJourneyIds, availableJourneyOptions, availableTemplateJourneys, importedRoutes, parsedDutyCount, selectedJourneyId])

  const preview = useMemo(() => buildSubstituteServicePlannerPreview({
    baseJourneys: referenceShiftState.document?.journeys,
    journeys: availableTemplateJourneys,
    maxDesiredBreakMinutes: Math.max(Number(maxDesiredBreakMinutes || 0) || 0, 0),
    minBreakMinutes: Math.max(Number(minBreakMinutes || 0) || 0, 0),
    routes: importedRoutes,
    shiftOrders: referenceShiftState.document?.shiftOrders ?? shiftOrders,
    templates: commitTemplates,
  }), [availableTemplateJourneys, commitTemplates, importedRoutes, maxDesiredBreakMinutes, minBreakMinutes, referenceShiftState.document, shiftOrders])

  const plannedCommit = useMemo(() => appendSubstituteServicePlan({
    document: {
      journeys,
      shiftOrders,
    },
    journeyOptions: availableJourneyOptions,
    preview,
    routes: importedRoutes,
    templates: commitTemplates,
  }), [availableJourneyOptions, commitTemplates, importedRoutes, journeys, preview, shiftOrders])
  const committableOrderCount = plannedCommit.createdOrders.length
  const addedJourneyDefinitionCount = plannedCommit.importedJourneys.length
  const plannedJourneyChangeCount = plannedCommit.journeyChanges.length
  const updatedCurrentJourneyCount = plannedCommit.journeyChanges.filter((change) => change.kind === 'current-retime').length
  const canCommitPlan = committableOrderCount > 0 && !referenceShiftState.error

  function handleCommitPlan() {
    if (!canCommitPlan) {
      return
    }

    onCommitPlan(plannedCommit)
  }

  return (
    <Modal centered scrollable show={show} size="xl" onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Substitute service planner</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Stack gap={3} className="compact-form">
          <Alert variant="info" className="mb-0 compact-alert">
            Preview a round-robin split of the current shift orders into two-leg substitute duties, then append the committed duties to the current shift.
            The pasted reference source stays read-only; committing always writes into the shift that is currently loaded in the editor.
          </Alert>

          <div className="compact-card">
            <div className="compact-card__header">
              <div className="compact-card__tag">Reference base shift</div>
            </div>

            <Stack gap={2}>
              <div className="compact-card__hint">
                Keep the target substitute-service shift loaded in the editor so the planner can append committed orders into it.
                Paste a different base-shift Luau module here to use it as the coverage reference and as an additional journey source for the leg selectors.
              </div>
              <Form.Control
                as="textarea"
                className="editor-textarea"
                placeholder="Optional: paste the base shift Luau source here to preview against a different shift."
                value={referenceShiftSource}
                onChange={(event) => setReferenceShiftSource(event.target.value)}
              />
              {referenceShiftState.error ? (
                <Alert variant="danger" className="mb-0 compact-alert">
                  {referenceShiftState.error}
                </Alert>
              ) : (
                <div className="compact-card__hint">
                  {referenceShiftState.document
                    ? `Using ${referenceShiftState.document.shiftOrders.length} base order${referenceShiftState.document.shiftOrders.length === 1 ? '' : 's'} and ${referenceShiftState.document.journeys.length} reference journey${referenceShiftState.document.journeys.length === 1 ? '' : 's'} from the pasted reference shift.`
                    : 'No reference shift pasted. The preview is currently using the shift orders loaded in the editor.'}
                </div>
              )}
            </Stack>
          </div>

          <Row className="g-3 align-items-start">
            <Col lg={4}>
              <Stack gap={3}>
                <div className="compact-card">
                  <div className="compact-card__header">
                    <div className="compact-card__tag">Configuration</div>
                  </div>

                  <Stack gap={3}>
                    <Form.Group>
                      <Form.Label className="soft-label">Substitute duties</Form.Label>
                      <Form.Control
                        max={maxDutyCount}
                        min={1}
                        type="number"
                        value={dutyCount}
                        onChange={(event) => setDutyCount(event.target.value)}
                      />
                    </Form.Group>

                    <Form.Group>
                      <Form.Label className="soft-label">Minimum retained break</Form.Label>
                      <Form.Control
                        min={0}
                        type="number"
                        value={minBreakMinutes}
                        onChange={(event) => setMinBreakMinutes(event.target.value)}
                      />
                    </Form.Group>

                    <Form.Group>
                      <Form.Label className="soft-label">Preferred maximum idle</Form.Label>
                      <Form.Control
                        min={0}
                        type="number"
                        value={maxDesiredBreakMinutes}
                        onChange={(event) => setMaxDesiredBreakMinutes(event.target.value)}
                      />
                    </Form.Group>
                  </Stack>
                </div>

                <div className="compact-card">
                  <div className="compact-card__header">
                    <div className="compact-card__tag">Base shift summary</div>
                  </div>

                  <Stack gap={2}>
                    <div className="compact-card__hint">
                      {preview.baseOrders.length} base order{preview.baseOrders.length === 1 ? '' : 's'} detected.
                    </div>
                    <div className="compact-card__hint">
                      Headway: {preview.averageHeadwayMinutes === null
                        ? 'n/a'
                        : `${preview.averageHeadwayMinutes} min avg`}
                      {preview.minHeadwayMinutes !== null && preview.maxHeadwayMinutes !== null
                        ? ` (${preview.minHeadwayMinutes}-${preview.maxHeadwayMinutes} min)`
                        : ''}
                    </div>
                    <div className="compact-card__hint">
                      Service window: {preview.serviceStartTime ?? '--'} {'->'} {preview.serviceEndTime ?? '--'}
                    </div>
                    <div className="compact-card__hint">
                      Current planner assumes chronological round-robin coverage: duty A gets base orders 1, 3, 5 ... and so on.
                    </div>
                    <div className="compact-card__hint">
                      Runtime excludes pause-before-journey values, but pause-after-journey still counts inside duty runtime. The remaining gap is treated as break time the generated duty can fit itself into.
                    </div>
                    <div className="compact-card__hint">
                      Suggested starts align to the first matching stop of Leg 1 in the base order timeline when that stop exists.
                    </div>
                    <div className="compact-card__hint">
                      Leg selectors accept current substitute journeys and, when pasted, reference base-shift journeys.
                    </div>
                  </Stack>
                </div>
              </Stack>
            </Col>

            <Col lg={8}>
              <Stack gap={3}>
                <Alert variant={getStatusVariant(preview.overallStatus)} className="mb-0 compact-alert">
                  {preview.overallMessage}
                </Alert>

                {plannedJourneyChangeCount > 0 ? (
                  <div className="compact-card">
                    <div className="compact-card__header">
                      <div className="compact-card__tag">Journey changes on commit</div>
                    </div>

                    <Stack gap={2}>
                      <Alert variant="warning" className="mb-0 compact-alert">
                        Commit will add or retime {plannedJourneyChangeCount} journey definition{plannedJourneyChangeCount === 1 ? '' : 's'} in the current shift. Review these changes before appending the planned orders.
                      </Alert>

                      {plannedCommit.journeyChanges.map((change) => (
                        <div className="compact-card__hint" key={`${change.kind}-${change.resultingJourneyKey}`}>
                          {describeJourneyChange(change)}
                        </div>
                      ))}
                    </Stack>
                  </div>
                ) : null}

                {templates.slice(0, parsedDutyCount).map((template, templateIndex) => {
                  const dutyPreview = preview.dutyPreviews[templateIndex]
                  const availableBreaks = dutyPreview?.assignedOrders.map((assignment) => assignment.availableBreakMinutes) ?? []
                  const interchangeOptions = getTemplateInterchangeOptions(
                    [template.firstJourneyId, template.secondJourneyId].filter(Boolean),
                    availableTemplateJourneys,
                    importedRoutes,
                  )

                  return (
                    <div className="compact-card" key={`substitute-duty-${templateIndex}`}>
                      <div className="compact-card__header">
                        <div>
                          <div className="compact-card__tag">Duty {String.fromCharCode(65 + templateIndex)}</div>
                          <div className="inherit-note">
                            Covers base orders {dutyPreview?.coverageOrderNumbers.length
                              ? dutyPreview.coverageOrderNumbers.join(', ')
                              : 'none'}
                          </div>
                        </div>
                        <Badge bg={getStatusVariant(dutyPreview?.status ?? 'warning')} text={(dutyPreview?.status ?? 'warning') === 'warning' ? 'dark' : undefined} pill>
                          {(dutyPreview?.status ?? 'warning').toUpperCase()}
                        </Badge>
                      </div>

                      <Row className="g-2 mb-3">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="soft-label">Leg 1</Form.Label>
                            <Form.Select
                              disabled={availableJourneyOptions.length === 0}
                              value={template.firstJourneyId}
                              onChange={(event) => setTemplates((currentTemplates) => currentTemplates.map((currentTemplate, currentIndex) => (
                                currentIndex === templateIndex
                                  ? { ...currentTemplate, firstJourneyId: event.target.value }
                                  : currentTemplate
                              )))}
                            >
                              {availableJourneyOptions.length === 0 ? <option value="">No journeys available</option> : null}
                              {renderJourneyOptions(currentJourneyOptions, referenceJourneyOptions)}
                            </Form.Select>
                          </Form.Group>
                        </Col>

                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="soft-label">Leg 2</Form.Label>
                            <Form.Select
                              disabled={availableJourneyOptions.length === 0}
                              value={template.secondJourneyId}
                              onChange={(event) => setTemplates((currentTemplates) => currentTemplates.map((currentTemplate, currentIndex) => (
                                currentIndex === templateIndex
                                  ? { ...currentTemplate, secondJourneyId: event.target.value }
                                  : currentTemplate
                              )))}
                            >
                              {availableJourneyOptions.length === 0 ? <option value="">No journeys available</option> : null}
                              {renderJourneyOptions(currentJourneyOptions, referenceJourneyOptions)}
                            </Form.Select>
                          </Form.Group>
                        </Col>
                      </Row>

                      <Form.Group className="mb-3">
                        <Form.Label className="soft-label">Interchange</Form.Label>
                        <Form.Select
                          disabled={interchangeOptions.length === 0}
                          value={template.interchangeKey}
                          onChange={(event) => setTemplates((currentTemplates) => currentTemplates.map((currentTemplate, currentIndex) => (
                            currentIndex === templateIndex
                              ? { ...currentTemplate, interchangeKey: event.target.value }
                              : currentTemplate
                          )))}
                        >
                          {interchangeOptions.length === 0 ? <option value="">No interchange stop available</option> : null}
                          {interchangeOptions.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>

                      <div className="compact-card__footer mb-3">
                        <div className="compact-card__hint">
                          Template: {dutyPreview?.selectedJourneyKeys.join(' -> ') || 'No journeys selected'}
                        </div>
                        <div className="compact-card__hint">
                          Interchange: {dutyPreview?.selectedInterchangeLabel ?? 'n/a'}
                        </div>
                        <div className="compact-card__hint">
                          Runtime: {dutyPreview?.runtimeMinutes === null ? 'n/a' : `${dutyPreview.runtimeMinutes} min`}
                        </div>
                        <div className="compact-card__hint">
                          Available break: {getBreakRangeLabel(availableBreaks)}
                        </div>
                      </div>

                      {dutyPreview?.assignedOrders.length ? (
                        <div className="table-responsive">
                          <table className="table table-dark table-sm align-middle mb-0">
                            <thead>
                              <tr>
                                <th>Base order</th>
                                <th>Match stop</th>
                                <th>Base time</th>
                                <th>Suggested start</th>
                                <th>Next assigned</th>
                                <th>Gap</th>
                                <th>Break</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dutyPreview.assignedOrders.map((assignment) => (
                                <tr key={assignment.orderId}>
                                  <td>{assignment.orderNumber}</td>
                                  <td>{assignment.matchedStopName ? `${assignment.matchedStopName}${assignment.matchedPlatform ? ` / ${assignment.matchedPlatform}` : ''}` : '--'}</td>
                                  <td>{assignment.baseAnchorTime ?? assignment.baseOrderStartTime ?? '--'}</td>
                                  <td>{assignment.startTime ?? '--'}</td>
                                  <td>{assignment.nextOrderNumber ?? '--'}</td>
                                  <td>{assignment.gapMinutes === null ? '--' : `${assignment.gapMinutes} min`}</td>
                                  <td>{assignment.availableBreakMinutes === null ? '--' : `${assignment.availableBreakMinutes} min`}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Alert variant="light" className="mb-0 compact-alert">
                          No base orders are currently assigned to this duty.
                        </Alert>
                      )}

                      {dutyPreview?.warnings.length ? (
                        <Stack gap={2} className="mt-3">
                          {dutyPreview.warnings.map((warning) => (
                            <Alert className="mb-0 compact-alert" key={warning} variant={dutyPreview.status === 'impossible' ? 'danger' : 'warning'}>
                              {warning}
                            </Alert>
                          ))}
                        </Stack>
                      ) : null}
                    </div>
                  )
                })}
              </Stack>
            </Col>
          </Row>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <div className="me-auto compact-card__hint">
          {canCommitPlan
            ? `Append ${committableOrderCount} planned order${committableOrderCount === 1 ? '' : 's'} to the current shift.${addedJourneyDefinitionCount > 0 ? ` ${addedJourneyDefinitionCount} journey definition${addedJourneyDefinitionCount === 1 ? '' : 's'} will be added first.` : updatedCurrentJourneyCount > 0 ? ` ${updatedCurrentJourneyCount} existing journey${updatedCurrentJourneyCount === 1 ? '' : 's'} will be updated first.` : ' Selected current journeys will be reused as-is.'} ${plannedJourneyChangeCount > 0 ? 'Review the journey change summary above before committing.' : ''}`
            : 'No committable planner orders are currently available.'}
        </div>
        <Button disabled={!canCommitPlan} variant="primary" onClick={handleCommitPlan}>
          Append To Current Shift
        </Button>
        <Button variant="outline-secondary" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  )
}