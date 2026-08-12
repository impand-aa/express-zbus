import { useMemo, useState } from 'react'
import { Alert, Button, ButtonGroup, Card, Col, Form, Row, Stack } from 'react-bootstrap'

import { CloneRouteOrdersModal } from './CloneRouteOrdersModal'
import { DisplayLineBadge } from './DisplayLineBadge'
import { JourneyOrderItem } from './JourneyOrderItem'
import { SubstituteServicePlannerModal } from './SubstituteServiceDemoModal'
import {
  buildUniqueJourneyKey,
  cloneJourneyOrderRows,
  createAdvanceRow,
  createAnnouncementRow,
  createCustomRow,
  createPanelRow,
  createStopRow,
  inferLineDisplayValue,
  sanitizeJourneyKey,
} from '../lib/document'
import type { AppendedSubstituteServicePlan } from '../lib/substituteServicePlanner'
import { findBestRouteMatch, getDisplayLinePreview, getInheritedOrdersPreview, getPanelDestination } from '../lib/referenceModules'
import type { ImportedPanelDefinition, ImportedRouteDefinition, ImportedSoundDefinition, JourneyDefinition, ShiftOrder } from '../types'

interface JourneyEditorPanelProps {
  importedPanels: ImportedPanelDefinition[]
  importedRoutes: ImportedRouteDefinition[]
  importedSounds: ImportedSoundDefinition[]
  journeys: JourneyDefinition[]
  onAppendSubstituteServicePlan: (plan: AppendedSubstituteServicePlan) => void
  selectedJourneyId: string | null
  shiftOrders: ShiftOrder[]
  onAddJourney: () => void
  onDuplicateJourney: (journeyId: string) => void
  onRemoveJourney: (journeyId: string) => void
  onSelectJourney: (journeyId: string) => void
  onUpdateJourney: (journeyId: string, updater: (journey: JourneyDefinition) => JourneyDefinition) => void
}

export function JourneyEditorPanel({
  importedPanels,
  importedRoutes,
  importedSounds,
  journeys,
  onAppendSubstituteServicePlan,
  selectedJourneyId,
  shiftOrders,
  onAddJourney,
  onDuplicateJourney,
  onRemoveJourney,
  onSelectJourney,
  onUpdateJourney,
}: JourneyEditorPanelProps) {
  const [showCloneRouteOrdersModal, setShowCloneRouteOrdersModal] = useState(false)
  const [showSubstituteServicePlannerModal, setShowSubstituteServicePlannerModal] = useState(false)
  const [draggedOrderRowId, setDraggedOrderRowId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ rowId: string, position: 'before' | 'after' } | null>(null)
  const selectedJourney = journeys.find((journey) => journey.id === selectedJourneyId) ?? journeys[0] ?? null
  const normalizedSelectedLineDisplay = selectedJourney ? inferLineDisplayValue(selectedJourney.lineDisplay.value) : null
  const routeMatch = selectedJourney ? findBestRouteMatch(selectedJourney, importedRoutes) : null
  const inheritedOrders = selectedJourney ? getInheritedOrdersPreview(selectedJourney, importedRoutes) : []
  const displayLinePreview = selectedJourney ? getDisplayLinePreview(selectedJourney, routeMatch) : null
  const isFallbackPreview = routeMatch?.mode === 'fallback'
  const platformUsageHintsByStopAndPlatform = useMemo(() => {
    const usageMap = new Map<string, Set<string>>()

    function getStopPlatformKey(stopName: string, platform: string) {
      return `${stopName.trim().toLowerCase()}::${platform.trim().toLowerCase()}`
    }

    for (const route of importedRoutes) {
      const lineText = route.lineDisplay.kind === 'nil' ? 'nil' : route.lineDisplay.value
      const destinations = route.orders
        .filter((row) => row.type === 'panel')
        .map((row) => getPanelDestination(importedPanels, row.args[0]?.value ?? ''))
        .filter((destination, index, values) => Boolean(destination.trim()) && values.indexOf(destination) === index)
      const destinationLabel = destinations.length > 0
        ? destinations.join(' / ')
        : route.lastStopName || route.firstStopName || '(No destination)'

      for (const row of route.orders) {
        if (row.type !== 'stop') {
          continue
        }

        const platform = row.args[1]?.value?.trim() ?? ''
        const stopName = row.args[0]?.value?.trim() ?? ''
        if (!platform || !stopName) {
          continue
        }

        const usageLabel = `${lineText} -> ${destinationLabel}`
        const stopPlatformKey = getStopPlatformKey(stopName, platform)
        const existingUsages = usageMap.get(stopPlatformKey) ?? new Set<string>()
        existingUsages.add(usageLabel)
        usageMap.set(stopPlatformKey, existingUsages)
      }
    }

    return new Map([...usageMap.entries()].map(([stopPlatformKey, usages]) => [
      stopPlatformKey,
      [...usages].sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })),
    ]))
  }, [importedPanels, importedRoutes])

  const stopNamesInImportedRoutes = useMemo(() => {
    const stopNames = new Set<string>()

    for (const route of importedRoutes) {
      for (const row of route.orders) {
        if (row.type !== 'stop') {
          continue
        }

        const stopName = row.args[0]?.value?.trim().toLowerCase() ?? ''
        if (stopName) {
          stopNames.add(stopName)
        }
      }
    }

    return stopNames
  }, [importedRoutes])

  const stopOccurrenceCountsInShift = useMemo(() => {
    const occurrenceCounts = new Map<string, number>()

    for (const journey of journeys) {
      for (const row of journey.orders) {
        if (row.type !== 'stop') {
          continue
        }

        const stopName = row.args[0]?.value?.trim().toLowerCase() ?? ''
        if (stopName) {
          occurrenceCounts.set(stopName, (occurrenceCounts.get(stopName) ?? 0) + 1)
        }
      }
    }

    return occurrenceCounts
  }, [journeys])

  function isStopUnmatched(row: { type: string, args: { value?: string }[] }) {
    if (row.type !== 'stop') {
      return false
    }

    const stopName = row.args[0]?.value?.trim().toLowerCase() ?? ''
    if (!stopName) {
      return false
    }

    if (stopNamesInImportedRoutes.has(stopName)) {
      return false
    }

    return (stopOccurrenceCountsInShift.get(stopName) ?? 0) < 2
  }

  function flipJourneyOrders() {
    if (!selectedJourney) {
      return
    }

    onUpdateJourney(selectedJourney.id, (currentJourney) => {
      if (currentJourney.orders.length <= 1) {
        return currentJourney
      }

      const [firstRow, ...remainingRows] = currentJourney.orders
      const reversedRemainingRows = [...remainingRows].reverse()

      if (firstRow!.type !== 'panel') {
        return {
          ...currentJourney,
          orders: [...currentJourney.orders].reverse(),
        }
      }

      // the initial panel's destination no longer applies once the direction flips
      const clearedFirstRow = {
        ...firstRow!,
        args: firstRow!.args.map((argument, index) => (index === 0 ? { ...argument, value: '' } : argument)),
      }

      return {
        ...currentJourney,
        orders: [clearedFirstRow, ...reversedRemainingRows],
      }
    })
  }

  function moveJourneyOrderRow(rowIndex: number, targetIndex: number) {
    if (!selectedJourney) {
      return
    }

    onUpdateJourney(selectedJourney.id, (currentJourney) => {
      if (
        rowIndex < 0 ||
        rowIndex >= currentJourney.orders.length ||
        targetIndex < 0 ||
        targetIndex >= currentJourney.orders.length ||
        rowIndex === targetIndex
      ) {
        return currentJourney
      }

      const nextOrders = [...currentJourney.orders]
      const [movedRow] = nextOrders.splice(rowIndex, 1)
      nextOrders.splice(targetIndex, 0, movedRow!)

      return {
        ...currentJourney,
        orders: nextOrders,
      }
    })
  }

  function clearDragState() {
    setDraggedOrderRowId(null)
    setDropTarget(null)
  }

  function getStopPlatformKey(stopName: string, platform: string) {
    return `${stopName.trim().toLowerCase()}::${platform.trim().toLowerCase()}`
  }

  function getDisplayedJourneyLineValue(journey: JourneyDefinition) {
    const normalizedLineDisplay = inferLineDisplayValue(journey.lineDisplay.value)
    return normalizedLineDisplay.kind === 'nil' ? 'nil' : normalizedLineDisplay.value
  }

  return (
    <Card className="workspace-panel border-0">
      <Card.Body className="p-3 p-xl-3">
        <Row className="g-3 align-items-start">
          <Col xl={3} lg={4}>
            <div className="panel-toolbar">
              <div className="panel-label">Journeys</div>
              <Button variant="outline-secondary" size="sm" onClick={onAddJourney}>
                New
              </Button>
            </div>

            <div className="entity-list">
              {journeys.map((journey) => (
                <button
                  className={`entity-button${selectedJourney?.id === journey.id ? ' is-active' : ''}`}
                  key={journey.id}
                  type="button"
                  onClick={() => onSelectJourney(journey.id)}
                >
                  <span className="entity-button__title">{journey.key}</span>
                  <span className="entity-button__meta">{getDisplayedJourneyLineValue(journey)} | {journey.from || '*'} {'->'} {journey.to || '*'}</span>
                  <span className="entity-button__meta">{journey.orders.length} row{journey.orders.length === 1 ? '' : 's'}</span>
                </button>
              ))}
            </div>
          </Col>

          <Col xl={9} lg={8}>
            {selectedJourney ? (
              <div className="editor-shell compact-form">
                <div className="editor-toolbar">
                  <ButtonGroup size="sm">
                    <Button variant="outline-secondary" onClick={() => onDuplicateJourney(selectedJourney.id)}>
                      Duplicate
                    </Button>
                    <Button variant="outline-danger" onClick={() => onRemoveJourney(selectedJourney.id)}>
                      Delete
                    </Button>
                  </ButtonGroup>
                </div>

                <Row className="g-2 align-items-end">
                  <Col xl={3} md={5}>
                    <Form.Group>
                      <Form.Label className="soft-label">Internal name</Form.Label>
                      <Form.Control
                        size="sm"
                        value={selectedJourney.key}
                        onChange={(event) => onUpdateJourney(selectedJourney.id, (currentJourney) => ({
                          ...currentJourney,
                          key: event.target.value,
                        }))}
                        onBlur={(event) => onUpdateJourney(selectedJourney.id, (currentJourney) => ({
                          ...currentJourney,
                          key: buildUniqueJourneyKey(
                            journeys,
                            sanitizeJourneyKey(event.target.value),
                            currentJourney.id,
                          ),
                        }))}
                      />
                    </Form.Group>
                  </Col>
                  <Col xl={3} md={3}>
                    <Form.Group>
                      <Form.Label className="soft-label">Line value</Form.Label>
                      <Form.Control
                        size="sm"
                        inputMode={normalizedSelectedLineDisplay?.kind === 'number' ? 'numeric' : 'text'}
                        placeholder="Optional"
                        type="text"
                        value={selectedJourney.lineDisplay.value}
                        onChange={(event) => onUpdateJourney(selectedJourney.id, (currentJourney) => ({
                          ...currentJourney,
                          lineDisplay: inferLineDisplayValue(event.target.value),
                        }))}
                      />
                    </Form.Group>
                  </Col>
                  <Col xl={2} md={2}>
                    <Form.Group>
                      <Form.Label className="soft-label">Pause before</Form.Label>
                      <Form.Control
                        size="sm"
                        step="any"
                        type="number"
                        placeholder="Optional"
                        value={selectedJourney.pauseBeforeJourney}
                        onChange={(event) => onUpdateJourney(selectedJourney.id, (currentJourney) => ({
                          ...currentJourney,
                          pauseBeforeJourney: event.target.value,
                        }))}
                      />
                    </Form.Group>
                  </Col>
                  <Col xl={2} md={2}>
                    <Form.Group>
                      <Form.Label className="soft-label">Pause after</Form.Label>
                      <Form.Control
                        size="sm"
                        step="any"
                        type="number"
                        placeholder="Optional"
                        value={selectedJourney.pauseAfterJourney}
                        onChange={(event) => onUpdateJourney(selectedJourney.id, (currentJourney) => ({
                          ...currentJourney,
                          pauseAfterJourney: event.target.value,
                        }))}
                      />
                    </Form.Group>
                  </Col>
                  {displayLinePreview ? (
                    <Col xl={2} md={4}>
                      <div className="soft-label mb-1">Line</div>
                      <DisplayLineBadge preview={displayLinePreview} />
                    </Col>
                  ) : null}
                  <Col xl={6} md={6}>
                    <Form.Group>
                      <Form.Label className="soft-label">From</Form.Label>
                      <Form.Control
                        size="sm"
                        placeholder="nil when empty"
                        value={selectedJourney.from}
                        onChange={(event) => onUpdateJourney(selectedJourney.id, (currentJourney) => ({
                          ...currentJourney,
                          from: event.target.value,
                        }))}
                      />
                    </Form.Group>
                  </Col>
                  <Col xl={6} md={6}>
                    <Form.Group>
                      <Form.Label className="soft-label">To</Form.Label>
                      <Form.Control
                        size="sm"
                        placeholder="nil when empty"
                        value={selectedJourney.to}
                        onChange={(event) => onUpdateJourney(selectedJourney.id, (currentJourney) => ({
                          ...currentJourney,
                          to: event.target.value,
                        }))}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <div className="panel-toolbar panel-toolbar--dense">
                  <div className="panel-label">Orders</div>
                  <div className="journey-orders-actions">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      disabled={shiftOrders.length === 0 || journeys.length === 0}
                      onClick={() => setShowSubstituteServicePlannerModal(true)}
                    >
                      Substitute service planner
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      disabled={importedRoutes.length === 0}
                      onClick={() => setShowCloneRouteOrdersModal(true)}
                    >
                      Clone route orders
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      disabled={selectedJourney.orders.length <= 1}
                      title="Reverses the order list, keeping the first row in place and clearing its panel id if it's a panel."
                      onClick={flipJourneyOrders}
                    >
                      Flip order
                    </Button>
                    <ButtonGroup size="sm">
                      <Button
                        variant="outline-secondary"
                        onClick={() => onUpdateJourney(selectedJourney.id, (currentJourney) => ({
                          ...currentJourney,
                          orders: [...currentJourney.orders, createPanelRow()],
                        }))}
                      >
                        Panel
                      </Button>
                      <Button
                        variant="outline-secondary"
                        onClick={() => onUpdateJourney(selectedJourney.id, (currentJourney) => ({
                          ...currentJourney,
                          orders: [...currentJourney.orders, createStopRow('', 'A', '')],
                        }))}
                      >
                        Stop
                      </Button>
                      <Button
                        variant="outline-secondary"
                        onClick={() => onUpdateJourney(selectedJourney.id, (currentJourney) => ({
                          ...currentJourney,
                          orders: [...currentJourney.orders, createAdvanceRow()],
                        }))}
                      >
                        Advance
                      </Button>
                      <Button
                        variant="outline-secondary"
                        onClick={() => onUpdateJourney(selectedJourney.id, (currentJourney) => ({
                          ...currentJourney,
                          orders: [...currentJourney.orders, createAnnouncementRow()],
                        }))}
                      >
                        Announcement
                      </Button>
                      <Button
                        variant="outline-secondary"
                        onClick={() => onUpdateJourney(selectedJourney.id, (currentJourney) => ({
                          ...currentJourney,
                          orders: [...currentJourney.orders, createCustomRow()],
                        }))}
                      >
                        Custom
                      </Button>
                    </ButtonGroup>
                  </div>
                </div>

                {selectedJourney.orders.length > 0 ? (
                  <Stack gap={2}>
                    {selectedJourney.orders.map((row, rowIndex) => (
                      <JourneyOrderItem
                        key={row.id}
                        importedSounds={importedSounds}
                        isDragSource={draggedOrderRowId === row.id}
                        isDropTargetAfter={dropTarget?.rowId === row.id && dropTarget.position === 'after'}
                        isDropTargetBefore={dropTarget?.rowId === row.id && dropTarget.position === 'before'}
                        isStopUnmatched={isStopUnmatched(row)}
                        panelDestination={row.type === 'panel' ? getPanelDestination(importedPanels, row.args[0]?.value ?? '') : ''}
                        platformUsageHints={row.type === 'stop'
                          ? (platformUsageHintsByStopAndPlatform.get(getStopPlatformKey(row.args[0]?.value ?? '', row.args[1]?.value ?? '')) ?? [])
                          : []}
                        row={row}
                        onChange={(nextRow) => onUpdateJourney(selectedJourney.id, (currentJourney) => ({
                          ...currentJourney,
                          orders: currentJourney.orders.map((currentRow, currentIndex) => (
                            currentIndex === rowIndex ? nextRow : currentRow
                          )),
                        }))}
                        onMove={(direction) => onUpdateJourney(selectedJourney.id, (currentJourney) => {
                          const targetIndex = rowIndex + direction
                          if (targetIndex < 0 || targetIndex >= currentJourney.orders.length) {
                            return currentJourney
                          }

                          const nextOrders = [...currentJourney.orders]
                          const [currentRow] = nextOrders.splice(rowIndex, 1)
                          nextOrders.splice(targetIndex, 0, currentRow!)
                          return {
                            ...currentJourney,
                            orders: nextOrders,
                          }
                        })}
                        onDragEnd={clearDragState}
                        onDragHover={(position) => {
                          if (!draggedOrderRowId || draggedOrderRowId === row.id) {
                            setDropTarget(null)
                            return
                          }

                          setDropTarget({ rowId: row.id, position })
                        }}
                        onDragStart={() => {
                          setDraggedOrderRowId(row.id)
                          setDropTarget(null)
                        }}
                        onDrop={(position) => {
                          if (!selectedJourney || !draggedOrderRowId || draggedOrderRowId === row.id) {
                            clearDragState()
                            return
                          }

                          const sourceIndex = selectedJourney.orders.findIndex((currentRow) => currentRow.id === draggedOrderRowId)
                          const hoveredIndex = selectedJourney.orders.findIndex((currentRow) => currentRow.id === row.id)
                          if (sourceIndex < 0 || hoveredIndex < 0) {
                            clearDragState()
                            return
                          }

                          let targetIndex = hoveredIndex
                          if (position === 'after') {
                            targetIndex = hoveredIndex + 1
                          }
                          if (sourceIndex < targetIndex) {
                            targetIndex -= 1
                          }

                          moveJourneyOrderRow(sourceIndex, targetIndex)
                          clearDragState()
                        }}
                        onRemove={() => onUpdateJourney(selectedJourney.id, (currentJourney) => ({
                          ...currentJourney,
                          orders: currentJourney.orders.filter((_, currentIndex) => currentIndex !== rowIndex),
                        }))}
                      />
                    ))}
                  </Stack>
                ) : null}

                {selectedJourney.orders.length === 0 && inheritedOrders.length > 0 ? (
                  <Stack gap={2}>
                    <div className="inherit-preview-bar">
                      {isFallbackPreview ? (
                        <Alert variant="warning" className="mb-0 compact-alert inherit-preview-alert">
                          Fallback route preview. This is the closest route match, not an exact source match.
                        </Alert>
                      ) : (
                        <div className="inherit-note">Inherited route preview</div>
                      )}
                    </div>
                    {inheritedOrders.map((row) => (
                      <JourneyOrderItem
                        key={row.id}
                        importedSounds={importedSounds}
                        isStopUnmatched={isStopUnmatched(row)}
                        muted
                        panelDestination={row.type === 'panel' ? getPanelDestination(importedPanels, row.args[0]?.value ?? '') : ''}
                        readOnly
                        row={row}
                      />
                    ))}
                  </Stack>
                ) : null}

                {selectedJourney.orders.length === 0 && inheritedOrders.length === 0 ? (
                  <Alert variant="light" className="mb-0 compact-alert">
                    {importedRoutes.length === 0
                      ? 'Import the Routes module in the Reference modules tab to preview inherited orders.'
                      : 'No inherited route could be resolved for this journey.'}
                  </Alert>
                ) : null}
              </div>
            ) : (
              <Alert variant="light" className="mb-0 compact-alert">
                Create a journey to start editing.
              </Alert>
            )}
          </Col>
        </Row>

        <CloneRouteOrdersModal
          preferredRouteId={routeMatch?.route.id ?? null}
          routes={importedRoutes}
          show={showCloneRouteOrdersModal}
          onClose={() => setShowCloneRouteOrdersModal(false)}
          onConfirm={(rows) => {
            if (!selectedJourney) {
              return
            }

            onUpdateJourney(selectedJourney.id, (currentJourney) => ({
              ...currentJourney,
              orders: [...currentJourney.orders, ...cloneJourneyOrderRows(rows)],
            }))
            setShowCloneRouteOrdersModal(false)
          }}
        />

        <SubstituteServicePlannerModal
          importedRoutes={importedRoutes}
          journeys={journeys}
          onCommitPlan={(plan) => {
            onAppendSubstituteServicePlan(plan)
            setShowSubstituteServicePlannerModal(false)
          }}
          selectedJourneyId={selectedJourneyId}
          shiftOrders={shiftOrders}
          show={showSubstituteServicePlannerModal}
          onClose={() => setShowSubstituteServicePlannerModal(false)}
        />
      </Card.Body>
    </Card>
  )
}