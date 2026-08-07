import { useState } from 'react'
import { Alert, Button, Modal } from 'react-bootstrap'

import { getPanelDestination } from '../lib/referenceModules'
import {
  buildShiftOrderTimeline,
  formatClockMinutesRoundedDown,
  type ShiftOrderTimelinePanelChange,
  type ShiftOrderTimelineSegment,
  type ShiftOrderTimelineStop,
} from '../lib/shiftTiming'
import type {
  ImportedPanelDefinition,
  ImportedRouteDefinition,
  JourneyDefinition,
  ShiftOrder,
} from '../types'

const AXIS_HEIGHT = 52
const CHART_MIN_HEIGHT = 280
const CHART_MIN_WIDTH = 960
const LABEL_COLUMN_WIDTH = 220
const MINUTE_PADDING = 36
const ROW_HEIGHT = 54

interface ShiftOrdersTimelineModalProps {
  importedPanels: ImportedPanelDefinition[]
  importedRoutes: ImportedRouteDefinition[]
  journeys: JourneyDefinition[]
  onClose: () => void
  selectedShiftOrderId: string | null
  shiftOrders: ShiftOrder[]
}

interface TooltipState {
  lines: string[]
  title: string
  x: number
  y: number
}

const TOOLTIP_HEIGHT_ESTIMATE = 164
const TOOLTIP_OFFSET = 16
const TOOLTIP_WIDTH_ESTIMATE = 288

function clampTooltipPosition(clientX: number, clientY: number) {
  const maxX = Math.max(window.innerWidth - TOOLTIP_WIDTH_ESTIMATE - 12, 12)
  const maxY = Math.max(window.innerHeight - TOOLTIP_HEIGHT_ESTIMATE - 12, 12)

  return {
    x: Math.min(clientX + TOOLTIP_OFFSET, maxX),
    y: Math.min(clientY + TOOLTIP_OFFSET, maxY),
  }
}

function getMinuteWidth(rangeMinutes: number) {
  if (rangeMinutes <= 90) {
    return 12
  }

  if (rangeMinutes <= 240) {
    return 8
  }

  if (rangeMinutes <= 540) {
    return 6
  }

  return 4
}

function getTickStep(rangeMinutes: number) {
  if (rangeMinutes <= 90) {
    return 5
  }

  if (rangeMinutes <= 240) {
    return 10
  }

  if (rangeMinutes <= 480) {
    return 15
  }

  if (rangeMinutes <= 900) {
    return 30
  }

  return 60
}

function getOrderColor(index: number) {
  const hue = (index * 41) % 360
  return `hsl(${hue} 76% 64%)`
}

function getWaypointKey(stopName: string, platform: string) {
  return `${stopName}::${platform}`
}

function getWaypointLabel(stopName: string, platform: string) {
  const normalizedStopName = stopName || '(Unnamed stop)'
  return platform ? `${normalizedStopName} / ${platform}` : normalizedStopName
}

function getPanelAnchorStop(segment: ShiftOrderTimelineSegment, panelChange: ShiftOrderTimelinePanelChange) {
  let anchorStop: ShiftOrderTimelineStop | null = segment.stops[0] ?? null

  for (const stop of segment.stops) {
    if (stop.timeOffsetMinutes <= panelChange.timeOffsetMinutes) {
      anchorStop = stop
    }
  }

  return anchorStop
}

export function ShiftOrdersTimelineModal({
  importedPanels,
  importedRoutes,
  journeys,
  onClose,
  selectedShiftOrderId,
  shiftOrders,
}: ShiftOrdersTimelineModalProps) {
  const sortedShiftOrders = [...shiftOrders].sort((left, right) => left.orderNumber - right.orderNumber)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [visibleOrderIds, setVisibleOrderIds] = useState<string[]>(() => sortedShiftOrders.map((order) => order.id))

  const orderColorById = new Map(sortedShiftOrders.map((order, index) => [order.id, getOrderColor(index)]))
  const panelDestinationsById = new Map(importedPanels.map((panel) => [String(panel.id), panel.destination]))
  const allTimelines = sortedShiftOrders.map((order) => buildShiftOrderTimeline(order, journeys, importedRoutes))
  const visibleOrderIdSet = new Set(visibleOrderIds)
  const visibleTimelines = allTimelines.filter((timeline) => visibleOrderIdSet.has(timeline.orderId))
  const waypoints: Array<{ key: string, label: string, platform: string, stopName: string }> = []
  const waypointIndexByKey = new Map<string, number>()
  const knownMinutes: number[] = []

  for (const timeline of allTimelines) {
    if (timeline.startMinutes !== null) {
      knownMinutes.push(timeline.startMinutes)
    }
    if (timeline.endMinutes !== null) {
      knownMinutes.push(timeline.endMinutes)
    }

    for (const segment of timeline.segments) {
      for (const stop of segment.stops) {
        if (stop.absoluteMinutes !== null) {
          knownMinutes.push(stop.absoluteMinutes)
        }

        if (!stop.stopName) {
          continue
        }

        const waypointKey = getWaypointKey(stop.stopName, stop.platform)
        if (!waypointIndexByKey.has(waypointKey)) {
          waypointIndexByKey.set(waypointKey, waypoints.length)
          waypoints.push({
            key: waypointKey,
            label: getWaypointLabel(stop.stopName, stop.platform),
            platform: stop.platform,
            stopName: stop.stopName,
          })
        }
      }

      for (const panelChange of segment.panelChanges) {
        if (panelChange.absoluteMinutes !== null) {
          knownMinutes.push(panelChange.absoluteMinutes)
        }
      }
    }
  }

  const hasRenderableTimeline = knownMinutes.length > 0 && waypoints.length > 0
  const minKnownMinutes = hasRenderableTimeline ? Math.min(...knownMinutes) : 0
  const maxKnownMinutes = hasRenderableTimeline ? Math.max(...knownMinutes) : 60
  const tickStep = getTickStep(maxKnownMinutes - minKnownMinutes)
  const displayStartMinutes = Math.floor(minKnownMinutes / tickStep) * tickStep
  const displayEndMinutes = Math.ceil(maxKnownMinutes / tickStep) * tickStep
  const displayRangeMinutes = Math.max(displayEndMinutes - displayStartMinutes, tickStep)
  const minuteWidth = getMinuteWidth(displayRangeMinutes)
  const chartWidth = Math.max(CHART_MIN_WIDTH, (displayRangeMinutes * minuteWidth) + (MINUTE_PADDING * 2))
  const chartHeight = Math.max(CHART_MIN_HEIGHT, waypoints.length * ROW_HEIGHT)
  const axisTicks: number[] = []

  for (let minute = displayStartMinutes; minute <= displayEndMinutes; minute += tickStep) {
    axisTicks.push(minute)
  }

  function getXPosition(absoluteMinutes: number) {
    return MINUTE_PADDING + ((absoluteMinutes - displayStartMinutes) * minuteWidth)
  }

  function getYPosition(waypointIndex: number) {
    return (waypointIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2)
  }

  function toggleOrderVisibility(orderId: string) {
    setVisibleOrderIds((currentVisibleOrderIds) => (
      currentVisibleOrderIds.includes(orderId)
        ? currentVisibleOrderIds.filter((currentOrderId) => currentOrderId !== orderId)
        : [...currentVisibleOrderIds, orderId]
    ))
  }

  return (
    <Modal fullscreen show dialogClassName="timeline-modal-dialog" onHide={onClose}>
      <Modal.Header closeButton>
        <div>
          <Modal.Title>Shift timeline</Modal.Title>
          <div className="timeline-modal__header-note">
            Time runs left to right, stop waypoints top to bottom, and continuous order lines reveal gaps or uneven intervals.
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-0">
        <div className="timeline-modal">
          <div className="timeline-modal__toolbar compact-form">
            <div className="timeline-modal__actions">
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => setVisibleOrderIds(sortedShiftOrders.map((order) => order.id))}
              >
                Show all orders
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={!selectedShiftOrderId}
                onClick={() => setVisibleOrderIds(selectedShiftOrderId ? [selectedShiftOrderId] : [])}
              >
                Current only
              </Button>
              <Button size="sm" variant="outline-secondary" onClick={() => setVisibleOrderIds([])}>
                Hide all
              </Button>
              <span className="timeline-modal__note">
                {visibleTimelines.length} visible / {sortedShiftOrders.length} total. Hover stop dots for details. Scroll both axes.
              </span>
            </div>

            <div className="timeline-modal__legend" role="group" aria-label="Order visibility legend">
              {sortedShiftOrders.map((order) => {
                const isVisible = visibleOrderIdSet.has(order.id)
                const isCurrent = selectedShiftOrderId === order.id
                const color = orderColorById.get(order.id) ?? '#7aa2ff'

                return (
                  <button
                    className={`timeline-legend__button${isVisible ? ' is-active' : ''}${isCurrent ? ' is-current' : ''}`}
                    key={order.id}
                    type="button"
                    onClick={() => toggleOrderVisibility(order.id)}
                  >
                    <span className="timeline-legend__swatch" style={{ backgroundColor: color }} />
                    <span>Order {order.orderNumber}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {!hasRenderableTimeline ? (
            <Alert variant="warning" className="m-3 compact-alert">
              Import or define journeys with stop timing data before opening the timeline.
            </Alert>
          ) : visibleTimelines.length === 0 ? (
            <Alert variant="light" className="m-3 compact-alert">
              Toggle at least one order on in the legend to draw the timeline.
            </Alert>
          ) : (
            <div className="timeline-sheet-shell" onMouseLeave={() => setTooltip(null)}>
              <div
                className="timeline-sheet"
                style={{
                  gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px ${chartWidth}px`,
                  gridTemplateRows: `${AXIS_HEIGHT}px ${chartHeight}px`,
                }}
              >
                <div className="timeline-sheet__corner">
                  <div className="compact-card__tag">Waypoints</div>
                  <div className="timeline-sheet__corner-note">{waypoints.length} stop rows</div>
                </div>

                <div className="timeline-sheet__axis">
                  <svg aria-hidden="true" height={AXIS_HEIGHT} width={chartWidth}>
                    {axisTicks.map((minute) => {
                      const x = getXPosition(minute)
                      return (
                        <g key={minute}>
                          <line
                            stroke="rgba(131, 146, 173, 0.2)"
                            strokeWidth={1}
                            x1={x}
                            x2={x}
                            y1={0}
                            y2={AXIS_HEIGHT}
                          />
                          <text
                            fill="#a8b4ca"
                            fontSize="11"
                            x={x + 4}
                            y={18}
                          >
                            {formatClockMinutesRoundedDown(minute)}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>

                <div className="timeline-sheet__waypoints">
                  <div className="timeline-sheet__waypoints-inner" style={{ height: chartHeight }}>
                    {waypoints.map((waypoint, waypointIndex) => (
                      <div
                        className="timeline-sheet__waypoint"
                        key={waypoint.key}
                        style={{
                          height: ROW_HEIGHT,
                          top: waypointIndex * ROW_HEIGHT,
                        }}
                      >
                        <div className="timeline-sheet__waypoint-label">{waypoint.stopName}</div>
                        <div className="timeline-sheet__waypoint-meta">
                          {waypoint.platform ? `Platform ${waypoint.platform}` : 'No platform'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="timeline-sheet__chart">
                  <svg height={chartHeight} role="img" width={chartWidth}>
                    {waypoints.map((waypoint, waypointIndex) => {
                      const rowTop = waypointIndex * ROW_HEIGHT
                      const y = getYPosition(waypointIndex)
                      return (
                        <g key={waypoint.key}>
                          <rect
                            fill={waypointIndex % 2 === 0 ? 'rgba(17, 22, 31, 0.44)' : 'rgba(10, 14, 21, 0.72)'}
                            height={ROW_HEIGHT}
                            width={chartWidth}
                            x={0}
                            y={rowTop}
                          />
                          <line
                            stroke="rgba(124, 139, 167, 0.1)"
                            strokeWidth={1}
                            x1={0}
                            x2={chartWidth}
                            y1={y}
                            y2={y}
                          />
                        </g>
                      )
                    })}

                    {axisTicks.map((minute) => {
                      const x = getXPosition(minute)
                      return (
                        <line
                          key={minute}
                          stroke="rgba(131, 146, 173, 0.14)"
                          strokeDasharray="4 5"
                          strokeWidth={1}
                          x1={x}
                          x2={x}
                          y1={0}
                          y2={chartHeight}
                        />
                      )
                    })}

                    {visibleTimelines.map((timeline) => {
                      const color = orderColorById.get(timeline.orderId) ?? '#7aa2ff'
                      const stopPoints = timeline.segments.flatMap((segment) => segment.stops.flatMap((stop, stopIndex) => {
                        if (stop.absoluteMinutes === null) {
                          return []
                        }

                        const waypointKey = getWaypointKey(stop.stopName, stop.platform)
                        const waypointIndex = waypointIndexByKey.get(waypointKey)
                        if (waypointIndex === undefined) {
                          return []
                        }

                        return [{
                          cycleIndex: segment.cycleIndex,
                          journeyKey: segment.journeyKey,
                          key: `${timeline.orderId}-${segment.nodeIndex}-${segment.sequenceIndex}-${stopIndex}`,
                          lineDisplay: segment.lineDisplay,
                          orderNumber: timeline.orderNumber,
                          absoluteMinutes: stop.absoluteMinutes,
                          platform: stop.platform,
                          stopName: stop.stopName,
                          time: formatClockMinutesRoundedDown(stop.absoluteMinutes),
                          x: getXPosition(stop.absoluteMinutes),
                          y: getYPosition(waypointIndex),
                        }]
                      }))
                      const pointString = stopPoints.map((point) => `${point.x},${point.y}`).join(' ')
                      const panelMarkers = timeline.segments.flatMap((segment, segmentIndex) => segment.panelChanges.flatMap((panelChange, panelIndex) => {
                        if (panelChange.absoluteMinutes === null) {
                          return []
                        }

                        const anchorStop = getPanelAnchorStop(segment, panelChange)
                        if (!anchorStop) {
                          return []
                        }

                        const anchorWaypointIndex = waypointIndexByKey.get(getWaypointKey(anchorStop.stopName, anchorStop.platform))
                        if (anchorWaypointIndex === undefined) {
                          return []
                        }

                        const destination = getPanelDestination(importedPanels, panelChange.panelIdValue) || panelDestinationsById.get(panelChange.panelIdValue) || ''
                        return [{
                          destination,
                          key: `${timeline.orderId}-panel-${segmentIndex}-${panelIndex}`,
                          label: panelChange.label,
                          title: destination
                            ? `${panelChange.label} | ${destination} | ${formatClockMinutesRoundedDown(panelChange.absoluteMinutes)}`
                            : `${panelChange.label} | ${formatClockMinutesRoundedDown(panelChange.absoluteMinutes)}`,
                          x: getXPosition(panelChange.absoluteMinutes),
                          y: Math.max(getYPosition(anchorWaypointIndex) - 14, 12),
                        }]
                      }))

                      return (
                        <g key={timeline.orderId}>
                          {stopPoints.length >= 2 ? (
                            <polyline
                              fill="none"
                              points={pointString}
                              stroke={color}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeOpacity={0.88}
                              strokeWidth={3}
                            />
                          ) : null}

                          {panelMarkers.map((panelMarker) => {
                            const markerWidth = Math.max((panelMarker.label.length * 7) + 12, 36)
                            return (
                              <g key={panelMarker.key}>
                                <title>{panelMarker.title}</title>
                                <rect
                                  fill="rgba(9, 13, 21, 0.88)"
                                  height={18}
                                  rx={9}
                                  stroke={color}
                                  strokeWidth={1}
                                  width={markerWidth}
                                  x={panelMarker.x + 6}
                                  y={panelMarker.y - 9}
                                />
                                <text
                                  fill={color}
                                  fontSize="11"
                                  fontWeight="700"
                                  x={panelMarker.x + 12}
                                  y={panelMarker.y + 4}
                                >
                                  {panelMarker.label}
                                </text>
                              </g>
                            )
                          })}

                          {stopPoints.map((point) => (
                            <circle
                              cx={point.x}
                              cy={point.y}
                              fill={color}
                              key={point.key}
                              r={4.5}
                              stroke="rgba(255, 255, 255, 0.92)"
                              strokeWidth={1.25}
                              onMouseEnter={(event) => {
                                const tooltipPosition = clampTooltipPosition(event.clientX, event.clientY)
                                setTooltip({
                                  lines: [
                                    `Time ${point.time ?? '--'}`,
                                    `Order ${point.orderNumber}`,
                                    point.platform ? `Platform ${point.platform}` : 'No platform',
                                    `Journey ${point.journeyKey}`,
                                    point.lineDisplay !== 'nil' ? `Line ${point.lineDisplay}` : 'Line nil',
                                    point.cycleIndex > 0 ? `Loop cycle ${point.cycleIndex + 1}` : 'Base cycle',
                                  ],
                                  title: point.stopName || '(Unnamed stop)',
                                  x: tooltipPosition.x,
                                  y: tooltipPosition.y,
                                })
                              }}
                              onMouseLeave={() => setTooltip(null)}
                              onMouseMove={(event) => setTooltip((currentTooltip) => (
                                currentTooltip
                                  ? {
                                    ...currentTooltip,
                                    ...clampTooltipPosition(event.clientX, event.clientY),
                                  }
                                  : currentTooltip
                              ))}
                            />
                          ))}
                        </g>
                      )
                    })}
                  </svg>
                </div>
              </div>
            </div>
          )}

          {tooltip ? (
            <div
              className="timeline-tooltip"
              style={{
                left: tooltip.x,
                top: tooltip.y,
              }}
            >
              <div className="timeline-tooltip__title">{tooltip.title}</div>
              {tooltip.lines.map((line) => (
                <div className="timeline-tooltip__line" key={line}>{line}</div>
              ))}
            </div>
          ) : null}
        </div>
      </Modal.Body>
    </Modal>
  )
}