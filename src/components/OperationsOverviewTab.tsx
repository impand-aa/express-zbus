import { useMemo, useState } from 'react'
import { Alert, Badge, Button, ButtonGroup, Card, Form, Stack } from 'react-bootstrap'

import { DisplayLineBadge } from './DisplayLineBadge'
import { buildOperationsOverviewData } from '../lib/operationsOverview'
import type { ImportedRouteDefinition, ShiftDocument } from '../types'

interface OperationsOverviewTabProps {
  documents: ShiftDocument[]
  importedRoutes: ImportedRouteDefinition[]
}

type OverviewViewMode = 'board' | 'timetable'

function getPlatformLabel(platform: string) {
  return platform ? `${platform}` : '?'
}

function getDutyOrderLabel(orderNumber: number) {
  return `/${orderNumber}`
}

function getMinuteLabel(departureTime: string) {
  const timeParts = departureTime.split(':')
  return timeParts.slice(1).join(':') || '--'
}

export function OperationsOverviewTab({ documents, importedRoutes }: OperationsOverviewTabProps) {
  const [selectedStopKey, setSelectedStopKey] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [stopFilter, setStopFilter] = useState('')
  const [viewMode, setViewMode] = useState<OverviewViewMode>('board')

  const overviewData = useMemo(() => buildOperationsOverviewData(documents, importedRoutes), [documents, importedRoutes])
  const totalJourneyCount = useMemo(() => (
    documents.reduce((journeyCount, document) => journeyCount + document.journeys.length, 0)
  ), [documents])
  const totalShiftOrderCount = useMemo(() => (
    documents.reduce((shiftOrderCount, document) => shiftOrderCount + document.shiftOrders.length, 0)
  ), [documents])
  const filteredStopOptions = useMemo(() => {
    const normalizedFilter = stopFilter.trim().toLowerCase()
    if (!normalizedFilter) {
      return overviewData.stopOptions
    }

    return overviewData.stopOptions.filter((stopOption) => stopOption.label.toLowerCase().includes(normalizedFilter))
  }, [overviewData.stopOptions, stopFilter])

  const resolvedSelectedStopKey = filteredStopOptions.find((stopOption) => stopOption.key === selectedStopKey)?.key
    ?? filteredStopOptions[0]?.key
    ?? overviewData.stopOptions.find((stopOption) => stopOption.key === selectedStopKey)?.key
    ?? overviewData.stopOptions[0]?.key
    ?? null
  const selectedStopOption = filteredStopOptions.find((stopOption) => stopOption.key === resolvedSelectedStopKey)
    ?? overviewData.stopOptions.find((stopOption) => stopOption.key === resolvedSelectedStopKey)
    ?? null
  const availablePlatforms = selectedStopOption?.platforms ?? []
  const resolvedSelectedPlatform = availablePlatforms.includes(selectedPlatform) ? selectedPlatform : ''
  const showPlatformColumn = !resolvedSelectedPlatform && availablePlatforms.length > 1
  const selectedDepartures = useMemo(() => (
    resolvedSelectedStopKey
      ? overviewData.departures.filter((departure) => (
        departure.stopKey === resolvedSelectedStopKey
        && (!resolvedSelectedPlatform || departure.platform === resolvedSelectedPlatform)
      ))
      : []
  ), [overviewData.departures, resolvedSelectedPlatform, resolvedSelectedStopKey])
  const departuresByHour = useMemo(() => {
    const hourMap = new Map<number, Map<string, { departures: typeof selectedDepartures, sortValue: number }>>()

    for (const departure of selectedDepartures) {
      const minuteLabel = getMinuteLabel(departure.departureTime)
      const minuteMap = hourMap.get(departure.hour)
      if (!minuteMap) {
        hourMap.set(departure.hour, new Map([[minuteLabel, {
          departures: [departure],
          sortValue: departure.departureMinutes,
        }]]))
        continue
      }

      const departuresForMinute = minuteMap.get(minuteLabel)
      if (departuresForMinute) {
        departuresForMinute.departures.push(departure)
        continue
      }

      minuteMap.set(minuteLabel, {
        departures: [departure],
        sortValue: departure.departureMinutes,
      })
    }

    return [...hourMap.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([hour, minuteMap]) => ({
        hour,
        minuteGroups: [...minuteMap.entries()]
          .sort((left, right) => left[1].sortValue - right[1].sortValue)
          .map(([minuteLabel, group]) => ({
            departures: group.departures,
            minuteLabel,
          })),
      }))
  }, [selectedDepartures])
  const servedLines = useMemo(() => {
    const linesByText = new Map<string, { count: number, preview: (typeof selectedDepartures)[number]['lineDisplayPreview'] }>()

    for (const departure of selectedDepartures) {
      const currentEntry = linesByText.get(departure.lineDisplayText)
      if (currentEntry) {
        currentEntry.count += 1
        continue
      }

      linesByText.set(departure.lineDisplayText, {
        count: 1,
        preview: departure.lineDisplayPreview,
      })
    }

    return [...linesByText.entries()].map(([lineDisplayText, value]) => ({
      count: value.count,
      lineDisplayText,
      preview: value.preview,
    }))
  }, [selectedDepartures])
  const firstDepartureTime = selectedDepartures[0]?.departureTime ?? '--:--'
  const lastDepartureTime = selectedDepartures.at(-1)?.departureTime ?? '--:--'
  const platformScopeLabel = resolvedSelectedPlatform
    ? getPlatformLabel(resolvedSelectedPlatform)
    : availablePlatforms.length > 1
      ? 'All platforms'
      : availablePlatforms[0]
        ? getPlatformLabel(availablePlatforms[0])
        : 'No platform'

  return (
    <Card className="workspace-panel border-0 code-panel">
      <Card.Body className="p-3 p-xl-3">
        <div className="operations-overview">
          <div className="operations-overview__sidebar compact-form">
            <Stack gap={3}>
              <div>
                <div className="panel-toolbar panel-toolbar--dense">
                  <div className="panel-label">Stops</div>
                  <Badge bg="secondary" pill>{overviewData.stopOptions.length} total</Badge>
                </div>

                <Form.Control
                  className="mb-2"
                  placeholder="Filter stops"
                  size="sm"
                  value={stopFilter}
                  onChange={(event) => setStopFilter(event.target.value)}
                />

                <div className="operations-overview__stop-list entity-list">
                  {filteredStopOptions.map((stopOption) => {
                    const isActive = stopOption.key === resolvedSelectedStopKey

                    return (
                      <button
                        className={`entity-button${isActive ? ' is-active' : ''}`}
                        key={stopOption.key}
                        type="button"
                        onClick={() => setSelectedStopKey(stopOption.key)}
                      >
                        <span className="entity-button__title">{stopOption.label}</span>
                        <span className="entity-button__meta">
                          {stopOption.departureCount} departures{stopOption.firstDepartureTime && stopOption.lastDepartureTime ? ` | ${stopOption.firstDepartureTime} - ${stopOption.lastDepartureTime}` : ''}{stopOption.platformCount > 1 ? ` | ${stopOption.platformCount} platforms` : stopOption.platforms[0] ? ` | ${getPlatformLabel(stopOption.platforms[0])}` : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </Stack>
          </div>

          <div className="operations-overview__content">
            {!selectedStopOption ? (
              <Alert variant="info" className="mb-0 compact-alert">
                No stop matches the current filter.
              </Alert>
            ) : (
              <Stack gap={3}>
                <div className="operations-overview__hero">
                  <div>
                    <div className="panel-label">Network overview</div>
                    <h2 className="operations-overview__title">All departures from {selectedStopOption.label}</h2>
                    <div className="operations-overview__subtitle">
                      Aggregated across {documents.length} shift source{documents.length === 1 ? '' : 's'}, {totalShiftOrderCount} shift order{totalShiftOrderCount === 1 ? '' : 's'}, and {totalJourneyCount} journey definition{totalJourneyCount === 1 ? '' : 's'}. Showing {platformScopeLabel.toLowerCase()}.
                    </div>
                  </div>

                  <div className="operations-overview__line-strip">
                    {servedLines.map((servedLine) => (
                      <div className="operations-overview__line-item" key={servedLine.lineDisplayText}>
                        <DisplayLineBadge preview={servedLine.preview} />
                        {/* <span>{servedLine.count}</span> */}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="operations-overview__stats">
                  <div className="operations-overview__stat">
                    <div className="panel-label">Departures</div>
                    <div className="operations-overview__stat-value">{selectedDepartures.length}</div>
                  </div>
                  <div className="operations-overview__stat">
                    <div className="panel-label">First</div>
                    <div className="operations-overview__stat-value">{firstDepartureTime}</div>
                  </div>
                  <div className="operations-overview__stat">
                    <div className="panel-label">Last</div>
                    <div className="operations-overview__stat-value">{lastDepartureTime}</div>
                  </div>
                  <div className="operations-overview__stat">
                    <div className="panel-label">Lines</div>
                    <div className="operations-overview__stat-value">{servedLines.length}</div>
                  </div>
                </div>

                <div className="operations-section operations-section--main">
                  <div className="panel-toolbar">
                    <div>
                      <div className="panel-label">Stop views</div>
                      <div className="operations-section__subtitle">
                        Switch between a live departure board and a denser hour-by-hour stop timetable.
                      </div>
                    </div>

                    <div className="operations-section__controls">
                      {availablePlatforms.length > 1 ? (
                        <Form.Select
                          aria-label="Filter by platform"
                          size="sm"
                          value={resolvedSelectedPlatform}
                          onChange={(event) => setSelectedPlatform(event.target.value)}
                        >
                          <option value="">All platforms</option>
                          {availablePlatforms.map((platform) => (
                            <option key={platform || '__none__'} value={platform}>{getPlatformLabel(platform)}</option>
                          ))}
                        </Form.Select>
                      ) : null}

                      <ButtonGroup size="sm" aria-label="Overview display mode">
                        <Button variant={viewMode === 'board' ? 'primary' : 'outline-secondary'} onClick={() => setViewMode('board')}>
                          Departure board
                        </Button>
                        <Button variant={viewMode === 'timetable' ? 'primary' : 'outline-secondary'} onClick={() => setViewMode('timetable')}>
                          Hourly timetable
                        </Button>
                      </ButtonGroup>

                      <Badge bg="secondary" pill>{selectedDepartures.length} departures</Badge>
                    </div>
                  </div>

                  {viewMode === 'board' ? (
                    <div className="operations-board">
                      {selectedDepartures.map((departure) => (
                        <div className={`operations-board__row${showPlatformColumn ? ' is-multiplatform' : ''}`} key={departure.id}>
                          <div className="operations-board__line">
                            <div className="operations-board__service-strip">
                              <DisplayLineBadge preview={departure.lineDisplayPreview} />
                              <span className="operations-board__service">{getDutyOrderLabel(departure.orderNumber)}</span>
                            </div>
                          </div>
                          {showPlatformColumn ? <div className="operations-board__platform">{getPlatformLabel(departure.platform)}</div> : null}
                          <div className="operations-board__direction">{departure.direction}</div>
                          <div className="operations-board__time">{departure.departureTime}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="operations-matrix">
                      {departuresByHour.map((hourBucket) => (
                        <div className="operations-matrix__row" key={hourBucket.hour}>
                          <div className="operations-matrix__hour">{String(hourBucket.hour).padStart(2, '0')}</div>
                          <div className="operations-matrix__entries">
                            {hourBucket.minuteGroups.map((minuteGroup) => (
                              <div className="operations-matrix__entry" key={`${hourBucket.hour}-${minuteGroup.minuteLabel}`}>
                                <div className="operations-matrix__minute">{minuteGroup.minuteLabel}</div>
                                <div className="operations-matrix__trips">
                                  {minuteGroup.departures.map((departure) => (
                                    <div className="operations-matrix__trip" key={departure.id}>
                                      <div className="operations-matrix__trip-head">
                                        <div className="operations-matrix__service-strip">
                                          <DisplayLineBadge preview={departure.lineDisplayPreview} />
                                          <span className="operations-matrix__service">{getDutyOrderLabel(departure.orderNumber)}</span>
                                        </div>
                                        {showPlatformColumn ? <span className="operations-matrix__platform">{getPlatformLabel(departure.platform)}</span> : null}
                                      </div>
                                      <span className="operations-matrix__direction" title={departure.direction}>{departure.direction}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Stack>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}