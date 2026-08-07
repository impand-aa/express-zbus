import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Form, Modal, Stack } from 'react-bootstrap'

import pandaIcon from '../assets/panda_icon.png'
import { DisplayLineBadge } from './DisplayLineBadge'
import { getDutyPaperPageLayout, paginateDutyPaperRows } from '../lib/dutyPaperLayout'
import { buildDutySchedulePaperPreview } from '../lib/dutySchedulePaper'
import type { ImportedRouteDefinition, JourneyDefinition, ShiftOrder } from '../types'

interface ShiftOrderDutyPaperModalProps {
  importedRoutes: ImportedRouteDefinition[]
  journeys: JourneyDefinition[]
  onClose: () => void
  shiftOrder: ShiftOrder
  show: boolean
}

function formatValidOnShift(value: string) {
  return value.trim()
}

function orderStopKeys(stopKeys: string[], orderedStopKeys: string[]) {
  const selectedStopKeySet = new Set(stopKeys)
  const orderedSelection = orderedStopKeys.filter((stopKey) => selectedStopKeySet.has(stopKey))

  for (const stopKey of stopKeys) {
    if (!orderedSelection.includes(stopKey)) {
      orderedSelection.push(stopKey)
    }
  }

  return orderedSelection
}

function getTripsPerRow(stopCount: number) {
  if (stopCount <= 3) {
    return 18
  }

  if (stopCount <= 5) {
    return 14
  }

  if (stopCount <= 7) {
    return 12
  }

  return 10
}

export function ShiftOrderDutyPaperModal({
  importedRoutes,
  journeys,
  onClose,
  shiftOrder,
  show,
}: ShiftOrderDutyPaperModalProps) {
  const [notes, setNotes] = useState('')
  const [selectedStopKeys, setSelectedStopKeys] = useState<string[]>([])
  const [stopOrderKeys, setStopOrderKeys] = useState<string[]>([])
  const [validOnShift, setValidOnShift] = useState('')

  const paperPreview = useMemo(
    () => buildDutySchedulePaperPreview(shiftOrder, journeys, importedRoutes),
    [importedRoutes, journeys, shiftOrder],
  )
  const defaultStopOrderKeys = useMemo(() => paperPreview.stopOptions.map((stopOption) => stopOption.key), [paperPreview.stopOptions])
  const orderedStopOptions = useMemo(() => {
    const stopOptionsByKey = new Map(paperPreview.stopOptions.map((stopOption) => [stopOption.key, stopOption]))
    const usedStopKeys = new Set<string>()
    const orderedStops = stopOrderKeys.flatMap((stopKey) => {
      const stopOption = stopOptionsByKey.get(stopKey)
      if (!stopOption || usedStopKeys.has(stopKey)) {
        return []
      }

      usedStopKeys.add(stopKey)
      return [stopOption]
    })

    for (const stopOption of paperPreview.stopOptions) {
      if (!usedStopKeys.has(stopOption.key)) {
        orderedStops.push(stopOption)
      }
    }

    return orderedStops
  }, [paperPreview.stopOptions, stopOrderKeys])
  const effectiveStopOrderKeys = useMemo(() => orderedStopOptions.map((stopOption) => stopOption.key), [orderedStopOptions])
  const selectedStopKeySet = useMemo(() => new Set(selectedStopKeys), [selectedStopKeys])
  const selectedStops = useMemo(() => orderedStopOptions.filter((stopOption) => selectedStopKeySet.has(stopOption.key)), [orderedStopOptions, selectedStopKeySet])
  const tripColumnRows = useMemo(() => {
    const tripsPerRow = getTripsPerRow(selectedStops.length)

    return Array.from({ length: Math.ceil(paperPreview.tripColumns.length / tripsPerRow) }, (_, rowIndex) => (
      paperPreview.tripColumns.slice(rowIndex * tripsPerRow, (rowIndex + 1) * tripsPerRow)
    ))
  }, [paperPreview.tripColumns, selectedStops.length])
  const visibleTripColumnRows = useMemo(() => (
    tripColumnRows
      .map((tripColumnRow) => ({
        tripColumnRow,
        visibleStops: selectedStops.filter((stopOption) => tripColumnRow.some((tripColumn) => Boolean(tripColumn.timesByStopKey[stopOption.key]))),
      }))
      .filter((tripColumnRow) => tripColumnRow.visibleStops.length > 0)
  ), [selectedStops, tripColumnRows])
  const visibleValidOnShift = formatValidOnShift(validOnShift)
  const visibleNotes = notes.trim()
  const paperPageLayout = useMemo(() => getDutyPaperPageLayout(selectedStops.length, Boolean(visibleNotes)), [selectedStops.length, visibleNotes])
  const tripColumnPages = useMemo(() => (
    paginateDutyPaperRows(visibleTripColumnRows, paperPageLayout.rowsPerPaper, paperPageLayout.lastPageRowsPerPaper)
  ), [paperPageLayout.lastPageRowsPerPaper, paperPageLayout.rowsPerPaper, visibleTripColumnRows])

  useEffect(() => {
    if (!show) {
      return
    }

    setNotes('')
    setSelectedStopKeys(orderStopKeys(paperPreview.defaultSelectedStopKeys, defaultStopOrderKeys))
    setStopOrderKeys(defaultStopOrderKeys)
    setValidOnShift('')
  }, [defaultStopOrderKeys, paperPreview.defaultSelectedStopKeys, shiftOrder.id, show])

  function toggleStopKey(stopKey: string) {
    setSelectedStopKeys((currentSelectedStopKeys) => (
      currentSelectedStopKeys.includes(stopKey)
        ? currentSelectedStopKeys.filter((currentStopKey) => currentStopKey !== stopKey)
        : orderStopKeys([...currentSelectedStopKeys, stopKey], effectiveStopOrderKeys)
    ))
  }

  function moveStopKey(stopKey: string, direction: -1 | 1) {
    setStopOrderKeys((currentStopOrderKeys) => {
      const resolvedStopOrderKeys = currentStopOrderKeys.length > 0 ? [...currentStopOrderKeys] : [...defaultStopOrderKeys]
      const currentIndex = resolvedStopOrderKeys.indexOf(stopKey)
      const nextIndex = currentIndex + direction

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= resolvedStopOrderKeys.length) {
        return currentStopOrderKeys
      }

      const movedStopKey = resolvedStopOrderKeys[currentIndex]
      resolvedStopOrderKeys[currentIndex] = resolvedStopOrderKeys[nextIndex]!
      resolvedStopOrderKeys[nextIndex] = movedStopKey!
      return resolvedStopOrderKeys
    })
  }

  return (
    <Modal fullscreen show dialogClassName="duty-paper-modal-dialog" onHide={onClose}>
      <Modal.Header closeButton>
        <div>
          <Modal.Title>Driver schedule paper</Modal.Title>
          <div className="timeline-modal__header-note">
            Build a printable duty sheet from the selected order, choose which stops to show, and review the compact paper layout.
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-0">
        <div className="duty-paper-modal">
          <div className="duty-paper-modal__controls compact-form">
            <Stack gap={3}>
              <div className="compact-card">
                <div className="compact-card__header">
                  <div className="compact-card__tag">Paper settings</div>
                </div>

                <Stack gap={3}>
                  <Form.Group>
                    <Form.Label className="soft-label">Duty</Form.Label>
                    <Form.Control readOnly value={String(shiftOrder.orderNumber)} />
                  </Form.Group>

                  <Form.Group>
                    <Form.Label className="soft-label">Valid on shift</Form.Label>
                    <Form.Control
                      placeholder="Optional, e.g. 22.5.2026"
                      value={validOnShift}
                      onChange={(event) => setValidOnShift(event.target.value)}
                    />
                  </Form.Group>

                  <Form.Group>
                    <Form.Label className="soft-label">Notes</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      placeholder="Optional driver note."
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                  </Form.Group>
                </Stack>
              </div>

              <div className="compact-card">
                <div className="compact-card__header">
                  <div className="compact-card__tag">Selected stops</div>
                </div>

                {paperPreview.stopOptions.length === 0 ? (
                  <Alert variant="warning" className="mb-0 compact-alert">
                    This duty does not currently produce any timed stops for a schedule paper.
                  </Alert>
                ) : (
                  <Stack gap={3}>
                    <div className="duty-paper-stops__actions">
                      <Button size="sm" variant="outline-secondary" onClick={() => setSelectedStopKeys(orderStopKeys(paperPreview.defaultSelectedStopKeys, effectiveStopOrderKeys))}>
                        Auto
                      </Button>
                      <Button size="sm" variant="outline-secondary" onClick={() => setSelectedStopKeys(effectiveStopOrderKeys)}>
                        All
                      </Button>
                      <Button size="sm" variant="outline-secondary" onClick={() => setSelectedStopKeys([])}>
                        Clear
                      </Button>
                    </div>

                    <div className="duty-paper-stops">
                      {orderedStopOptions.map((stopOption, stopIndex) => (
                        <div className="duty-paper-stops__item" key={stopOption.key}>
                          <Form.Check
                            checked={selectedStopKeySet.has(stopOption.key)}
                            className="duty-paper-stops__toggle"
                            id={`duty-paper-stop-${stopOption.key}`}
                            label={stopOption.label}
                            type="checkbox"
                            onChange={() => toggleStopKey(stopOption.key)}
                          />

                          <div className="duty-paper-stops__reorder">
                            <Button
                              disabled={stopIndex === 0}
                              size="sm"
                              type="button"
                              variant="outline-secondary"
                              onClick={() => moveStopKey(stopOption.key, -1)}
                            >
                              Up
                            </Button>
                            <Button
                              disabled={stopIndex === orderedStopOptions.length - 1}
                              size="sm"
                              type="button"
                              variant="outline-secondary"
                              onClick={() => moveStopKey(stopOption.key, 1)}
                            >
                              Down
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Stack>
                )}
              </div>
            </Stack>
          </div>

          <div className="duty-paper-modal__preview">
            {paperPreview.tripColumns.length === 0 ? (
              <Alert variant="warning" className="m-3 compact-alert">
                Import or define journeys with stop timing data before opening the schedule paper.
              </Alert>
            ) : selectedStops.length === 0 ? (
              <Alert variant="light" className="m-3 compact-alert">
                Select at least one stop to populate the paper table.
              </Alert>
            ) : visibleTripColumnRows.length === 0 ? (
              <Alert variant="light" className="m-3 compact-alert">
                The selected stops do not have any departures in this duty.
              </Alert>
            ) : (
              <div className="duty-paper-preview-shell">
                {tripColumnPages.map((tripColumnPage, pageIndex) => {
                  const isLastPage = pageIndex === tripColumnPages.length - 1
                  const showJourneySummary = pageIndex === 0

                  return (
                    <div
                      className={`duty-paper-sheet${isLastPage && visibleNotes ? '' : ' duty-paper-sheet--without-notes'}`}
                      key={`duty-paper-sheet-${pageIndex}`}
                      style={{
                        minHeight: `${paperPageLayout.sheetMinHeightRem}rem`,
                      }}
                    >
                      <div className="duty-paper-sheet__header">
                        <div className="duty-paper-sheet__topline">
                          <div className="duty-paper-sheet__identity">
                            <DisplayLineBadge className="duty-paper-sheet__line-badge" forceSquare preview={paperPreview.lineDisplayPreview} />

                            <div className="duty-paper-sheet__duty-inline">
                              <div className="duty-paper-sheet__heading">Duty</div>
                              <div className="duty-paper-sheet__value duty-paper-sheet__value--inline">{shiftOrder.orderNumber}</div>
                            </div>
                          </div>

                          <div className="duty-paper-sheet__meta-right">
                            {visibleValidOnShift ? (
                              <div className="duty-paper-sheet__validity">
                                <div className="duty-paper-sheet__heading">Valid on shift</div>
                                <div className="duty-paper-sheet__value duty-paper-sheet__value--compact">{visibleValidOnShift}</div>
                              </div>
                            ) : null}

                            <img alt="Shift paper logo" className="duty-paper-sheet__logo" src={pandaIcon} />
                          </div>
                        </div>

                        {showJourneySummary && (paperPreview.startsWithSummary || paperPreview.endsWithSummary) ? (
                          <div className="duty-paper-sheet__summary-row">
                            {paperPreview.startsWithSummary ? (
                              <div className="duty-paper-sheet__summary-item">
                                <div className="duty-paper-sheet__summary-label">Starts with</div>
                                <div className="duty-paper-sheet__summary-value">{paperPreview.startsWithSummary}</div>
                              </div>
                            ) : null}

                            {paperPreview.endsWithSummary ? (
                              <div className="duty-paper-sheet__summary-item">
                                <div className="duty-paper-sheet__summary-label">Finishes with</div>
                                <div className="duty-paper-sheet__summary-value">{paperPreview.endsWithSummary}</div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="duty-paper-sheet__rows">
                        {tripColumnPage.map(({ tripColumnRow, visibleStops }, rowIndex) => {
                          const absoluteRowIndex = tripColumnPages
                            .slice(0, pageIndex)
                            .reduce((total, currentPage) => total + currentPage.length, 0) + rowIndex

                          return (
                            <div className="duty-paper-sheet__row" key={`duty-paper-row-${absoluteRowIndex}`}>
                              <table className="duty-paper-table duty-paper-table--compact">
                                <tbody>
                                  {visibleStops.map((stopOption) => (
                                    <tr key={`${absoluteRowIndex}-${stopOption.key}`}>
                                      <th className="duty-paper-table__stop-cell">{stopOption.label}</th>
                                      {tripColumnRow.map((tripColumn) => {
                                        const time = tripColumn.timesByStopKey[stopOption.key] ?? '----'
                                        const isOrigin = tripColumn.originStopKey === stopOption.key
                                        const isTerminal = tripColumn.endStopKey === stopOption.key

                                        return (
                                          <td
                                            className={`duty-paper-table__time-cell${isOrigin ? ' is-origin' : ''}${isTerminal ? ' is-terminal' : ''}`}
                                            key={`${tripColumn.id}-${stopOption.key}`}
                                          >
                                            {time}
                                          </td>
                                        )
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )
                        })}
                      </div>

                      {isLastPage && visibleNotes ? (
                        <div className="duty-paper-sheet__notes">
                          <div className="duty-paper-sheet__summary-label">Notes</div>
                          <div className="duty-paper-sheet__summary-value">{visibleNotes}</div>
                        </div>
                      ) : null}

                      <div className="duty-paper-sheet__spacer" />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="me-auto compact-card__hint">
          The preview uses one duty only. Grey cells mark journey starting points and the trip rows are split into equal-height papers based on the selected stop count.
        </div>
        <Button variant="outline-secondary" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  )
}