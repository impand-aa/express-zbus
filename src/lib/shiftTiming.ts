import { findBestRouteMatch } from './referenceModules'
import type { ImportedRouteDefinition, JourneyDefinition, ShiftOrder, TimePlanNode } from '../types'

export interface JourneyDurationInfo {
  isDisplayable: boolean
  isResolvable: boolean
  pauseMinutes: number
  travelMinutes: number
  totalMinutes: number
}

export interface JourneyRuntimeInfo {
  isDisplayable: boolean
  isResolvable: boolean
  pauseAfterMinutes: number
  pauseBeforeMinutes: number
  routeDurationMinutes: number
  totalMinutes: number
}

export interface JourneyNodeLoopSummary {
  estimatedEndTime: string | null
  totalDurationMinutes: number
}

export interface JourneyNodeTimingPreview {
  journeyDurations: JourneyDurationInfo[]
  loopSummary: JourneyNodeLoopSummary | null
}

export interface ShiftOrderTimelineStop {
  absoluteMinutes: number | null
  platform: string
  stopName: string
  time: string | null
  timeOffsetMinutes: number
}

export interface ShiftOrderTimelinePanelChange {
  absoluteMinutes: number | null
  label: string
  panelIdValue: string
  time: string | null
  timeOffsetMinutes: number
}

export interface ShiftOrderTimelineSegment {
  cycleIndex: number
  departureMinutes: number | null
  departureTime: string | null
  durationMinutes: number
  endMinutes: number | null
  endTime: string | null
  from: string
  isDisplayable: boolean
  isResolvable: boolean
  journeyId: string
  journeyKey: string
  label: string
  lineDisplay: string
  nodeIndex: number
  panelChanges: ShiftOrderTimelinePanelChange[]
  pauseAfterMinutes: number
  pauseBeforeMinutes: number
  routeDurationMinutes: number
  sequenceIndex: number
  startMinutes: number | null
  startTime: string | null
  stops: ShiftOrderTimelineStop[]
  to: string
}

export interface ShiftOrderTimeline {
  endMinutes: number | null
  endTime: string | null
  orderId: string
  orderNumber: number
  segments: ShiftOrderTimelineSegment[]
  startMinutes: number | null
  startTime: string | null
  totalDurationMinutes: number
}

interface JourneyTimingBreakdown extends JourneyDurationInfo {
  orders: JourneyDefinition['orders'] | null
  pauseAfterMinutes: number
  pauseBeforeMinutes: number
  routeDurationMinutes: number
}

function normalizeMinutePrecision(totalMinutes: number) {
  return Math.round(totalMinutes * 60) / 60
}

function parseMinuteValue(value: string) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? normalizeMinutePrecision(numericValue) : null
}

function parseClockMinutes(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!match) {
    return null
  }

  return (Number(match[1]) * 60) + Number(match[2])
}

function resolveNextClockMinutes(value: string, currentTimeMinutes: number | null) {
  const parsedMinutes = parseClockMinutes(value)
  if (parsedMinutes === null || currentTimeMinutes === null) {
    return parsedMinutes
  }

  const currentDayStartMinutes = Math.floor(currentTimeMinutes / 1440) * 1440
  let resolvedMinutes = currentDayStartMinutes + parsedMinutes

  while (resolvedMinutes < currentTimeMinutes) {
    resolvedMinutes += 1440
  }

  return resolvedMinutes
}

function resolveServiceDayClockMinutes(value: string, currentTimeMinutes: number | null) {
  const parsedMinutes = parseClockMinutes(value)
  if (parsedMinutes === null || currentTimeMinutes === null) {
    return parsedMinutes
  }

  const currentDayStartMinutes = Math.floor(currentTimeMinutes / 1440) * 1440
  const currentMinuteOfDay = ((currentTimeMinutes % 1440) + 1440) % 1440
  const backwardDifferenceMinutes = currentMinuteOfDay - parsedMinutes

  if (backwardDifferenceMinutes > 720) {
    return currentDayStartMinutes + parsedMinutes + 1440
  }

  return currentDayStartMinutes + parsedMinutes
}

function resolveLoopUntilClockMinutes(value: string, currentTimeMinutes: number | null) {
  return resolveServiceDayClockMinutes(value, currentTimeMinutes)
}

function resolveTimeNodeClockMinutes(node: TimePlanNode, currentTimeMinutes: number | null) {
  return node.allowBackwardTime
    ? resolveServiceDayClockMinutes(node.time, currentTimeMinutes)
    : resolveNextClockMinutes(node.time, currentTimeMinutes)
}

export function formatClockMinutes(totalMinutes: number) {
  const normalizedSeconds = ((Math.round(totalMinutes * 60) % 86400) + 86400) % 86400
  const hours = String(Math.floor(normalizedSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((normalizedSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = normalizedSeconds % 60

  return seconds === 0
    ? `${hours}:${minutes}`
    : `${hours}:${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatClockMinutesRoundedDown(totalMinutes: number) {
  const normalizedMinutes = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440
  const hours = String(Math.floor(normalizedMinutes / 60)).padStart(2, '0')
  const minutes = String(normalizedMinutes % 60).padStart(2, '0')

  return `${hours}:${minutes}`
}

function getJourneyLabel(journey: JourneyDefinition) {
  const lineDisplay = journey.lineDisplay.value.trim() || 'nil'
  const from = journey.from || '*'
  const to = journey.to || '*'

  return `${journey.key} | ${lineDisplay} | ${from} -> ${to}`
}

function getJourneyEffectiveOrders(journey: JourneyDefinition, routes: ImportedRouteDefinition[]) {
  if (journey.orders.length > 0) {
    return journey.orders
  }

  const match = findBestRouteMatch(journey, routes)
  if (match?.mode !== 'source') {
    return null
  }

  return match.route.orders
}

function getRouteDurationMinutes(journey: JourneyDefinition, routes: ImportedRouteDefinition[]) {
  const orders = getJourneyEffectiveOrders(journey, routes)
  if (!orders) {
    return null
  }

  let totalDurationMinutes = 0

  for (const row of orders) {
    if (row.type !== 'stop') {
      continue
    }

    const stopMinuteOffset = row.args[2]?.value ? parseMinuteValue(row.args[2].value) : 0
    if (stopMinuteOffset === null) {
      continue
    }

    totalDurationMinutes = Math.max(totalDurationMinutes, stopMinuteOffset)
  }

  return totalDurationMinutes
}

function getPauseBeforeJourneyMinutes(journey: JourneyDefinition) {
  return journey.pauseBeforeJourney ? parseMinuteValue(journey.pauseBeforeJourney) ?? 0 : 0
}

function getPauseAfterJourneyMinutes(journey: JourneyDefinition) {
  return journey.pauseAfterJourney ? parseMinuteValue(journey.pauseAfterJourney) ?? 0 : 0
}

function getJourneyTimingBreakdown(journey: JourneyDefinition, routes: ImportedRouteDefinition[]): JourneyTimingBreakdown {
  const orders = getJourneyEffectiveOrders(journey, routes)
  if (!orders) {
    return {
      isDisplayable: false,
      isResolvable: false,
      orders: null,
      pauseAfterMinutes: 0,
      pauseMinutes: 0,
      pauseBeforeMinutes: 0,
      routeDurationMinutes: 0,
      totalMinutes: 0,
      travelMinutes: 0,
    }
  }

  const routeDurationMinutes = getRouteDurationMinutes(journey, routes) ?? 0
  const pauseBeforeMinutes = getPauseBeforeJourneyMinutes(journey)
  const pauseAfterMinutes = getPauseAfterJourneyMinutes(journey)
  const totalMinutes = normalizeMinutePrecision(Math.max(0, pauseBeforeMinutes + routeDurationMinutes + pauseAfterMinutes))

  return {
    isDisplayable: totalMinutes > 0,
    isResolvable: true,
    orders,
    pauseAfterMinutes,
    pauseMinutes: pauseBeforeMinutes + pauseAfterMinutes,
    pauseBeforeMinutes,
    routeDurationMinutes,
    totalMinutes,
    travelMinutes: routeDurationMinutes,
  }
}

export function getJourneyDurationInfo(journey: JourneyDefinition, routes: ImportedRouteDefinition[]): JourneyDurationInfo {
  const breakdown = getJourneyTimingBreakdown(journey, routes)

  return {
    isDisplayable: breakdown.isDisplayable,
    isResolvable: breakdown.isResolvable,
    pauseMinutes: breakdown.pauseBeforeMinutes + breakdown.pauseAfterMinutes,
    totalMinutes: breakdown.totalMinutes,
    travelMinutes: breakdown.routeDurationMinutes,
  }
}

export function getJourneyRuntimeInfo(journey: JourneyDefinition, routes: ImportedRouteDefinition[]): JourneyRuntimeInfo {
  const breakdown = getJourneyTimingBreakdown(journey, routes)

  return {
    isDisplayable: breakdown.routeDurationMinutes + breakdown.pauseAfterMinutes > 0,
    isResolvable: breakdown.isResolvable,
    pauseAfterMinutes: breakdown.pauseAfterMinutes,
    pauseBeforeMinutes: breakdown.pauseBeforeMinutes,
    routeDurationMinutes: breakdown.routeDurationMinutes,
    totalMinutes: breakdown.routeDurationMinutes + breakdown.pauseAfterMinutes,
  }
}

export function getShiftOrderTimingPreviews(
  order: ShiftOrder,
  journeys: JourneyDefinition[],
  routes: ImportedRouteDefinition[],
) {
  const journeysById = new Map(journeys.map((journey) => [journey.id, journey]))
  let currentTimeMinutes: number | null = null

  return order.nodes.map((node): JourneyNodeTimingPreview => {
    if (node.kind === 'time') {
      currentTimeMinutes = resolveTimeNodeClockMinutes(node, currentTimeMinutes)
      return {
        journeyDurations: [],
        loopSummary: null,
      }
    }

    const journeyDurations = node.journeyIds.map((journeyId) => {
      const journey = journeysById.get(journeyId)
      return journey
        ? getJourneyDurationInfo(journey, routes)
        : {
          isDisplayable: false,
          isResolvable: false,
          pauseMinutes: 0,
          totalMinutes: 0,
          travelMinutes: 0,
        }
    })

    const hasUnknownDuration = journeyDurations.some((journeyDuration) => !journeyDuration.isResolvable)
    const cycleDurationMinutes = hasUnknownDuration
      ? null
      : journeyDurations.reduce((total, journeyDuration) => total + journeyDuration.totalMinutes, 0)

    let loopSummary: JourneyNodeLoopSummary | null = null
    let consumedDurationMinutes = cycleDurationMinutes

    if (cycleDurationMinutes !== null && cycleDurationMinutes > 0) {
      if (node.loopUntil && currentTimeMinutes !== null) {
        const loopUntilMinutes = resolveLoopUntilClockMinutes(node.loopUntil, currentTimeMinutes)

        if (loopUntilMinutes !== null) {
          let endTimeMinutes = currentTimeMinutes
          do {
            endTimeMinutes = normalizeMinutePrecision(endTimeMinutes + cycleDurationMinutes)
          } while (endTimeMinutes < loopUntilMinutes)

          consumedDurationMinutes = normalizeMinutePrecision(endTimeMinutes - currentTimeMinutes)
          loopSummary = {
            estimatedEndTime: formatClockMinutes(endTimeMinutes),
            totalDurationMinutes: consumedDurationMinutes,
          }
        } else {
          consumedDurationMinutes = null
        }
      } else {
        loopSummary = {
          estimatedEndTime: currentTimeMinutes === null ? null : formatClockMinutes(currentTimeMinutes + cycleDurationMinutes),
          totalDurationMinutes: cycleDurationMinutes,
        }
      }
    }

    if (currentTimeMinutes !== null) {
      if (consumedDurationMinutes === null) {
        currentTimeMinutes = null
      } else {
        currentTimeMinutes = normalizeMinutePrecision(currentTimeMinutes + consumedDurationMinutes)
      }
    }

    return {
      journeyDurations,
      loopSummary,
    }
  })
}

export function buildShiftOrderTimeline(
  order: ShiftOrder,
  journeys: JourneyDefinition[],
  routes: ImportedRouteDefinition[],
): ShiftOrderTimeline {
  const journeysById = new Map(journeys.map((journey) => [journey.id, journey]))
  const segments: ShiftOrderTimelineSegment[] = []
  let currentTimeMinutes: number | null = null
  let orderStartMinutes: number | null = null
  let orderEndMinutes: number | null = null

  function pushJourneyCycle(nodeIndex: number, cycleIndex: number, journeyIds: string[]) {
    for (let sequenceIndex = 0; sequenceIndex < journeyIds.length; sequenceIndex += 1) {
      const journeyId = journeyIds[sequenceIndex]
      const journey = journeyId ? journeysById.get(journeyId) : null
      const breakdown = journey ? getJourneyTimingBreakdown(journey, routes) : {
        isDisplayable: false,
        isResolvable: false,
        orders: null,
        pauseAfterMinutes: 0,
        pauseBeforeMinutes: 0,
        routeDurationMinutes: 0,
        totalMinutes: 0,
      }

      const startMinutes = currentTimeMinutes
      const departureMinutes = currentTimeMinutes === null ? null : normalizeMinutePrecision(currentTimeMinutes + breakdown.pauseBeforeMinutes)
      const endMinutes = departureMinutes === null ? null : normalizeMinutePrecision(departureMinutes + breakdown.routeDurationMinutes)
      const consumedEndMinutes = endMinutes === null ? null : normalizeMinutePrecision(endMinutes + breakdown.pauseAfterMinutes)
      let latestWaypointOffsetMinutes = 0
      const stops: ShiftOrderTimelineStop[] = []
      const panelChanges: ShiftOrderTimelinePanelChange[] = []

      for (const row of breakdown.orders ?? []) {
        if (row.type === 'stop') {
          const timeOffsetMinutes = row.args[2]?.value ? parseMinuteValue(row.args[2].value) ?? 0 : 0
          const absoluteMinutes = departureMinutes === null ? null : normalizeMinutePrecision(departureMinutes + timeOffsetMinutes)

          latestWaypointOffsetMinutes = timeOffsetMinutes
          stops.push({
            absoluteMinutes,
            platform: row.args[1]?.value ?? '',
            stopName: row.args[0]?.value ?? '',
            time: absoluteMinutes === null ? null : formatClockMinutes(absoluteMinutes),
            timeOffsetMinutes,
          })
          continue
        }

        if (row.type === 'panel') {
          const panelIdValue = row.args[0]?.value ?? ''
          const absoluteMinutes = departureMinutes === null ? null : normalizeMinutePrecision(departureMinutes + latestWaypointOffsetMinutes)

          panelChanges.push({
            absoluteMinutes,
            label: `P ${panelIdValue}`,
            panelIdValue,
            time: absoluteMinutes === null ? null : formatClockMinutes(absoluteMinutes),
            timeOffsetMinutes: latestWaypointOffsetMinutes,
          })
        }
      }

      segments.push({
        cycleIndex,
        departureMinutes,
        departureTime: departureMinutes === null ? null : formatClockMinutes(departureMinutes),
        durationMinutes: breakdown.totalMinutes,
        endMinutes,
        endTime: endMinutes === null ? null : formatClockMinutes(endMinutes),
        from: journey?.from || '*',
        isDisplayable: breakdown.isDisplayable,
        isResolvable: breakdown.isResolvable,
        journeyId: journey?.id ?? journeyId ?? `missing-${nodeIndex}-${sequenceIndex}`,
        journeyKey: journey?.key ?? '(missing journey)',
        label: journey ? getJourneyLabel(journey) : '(missing journey)',
        lineDisplay: journey?.lineDisplay.value.trim() || 'nil',
        nodeIndex,
        panelChanges,
        pauseAfterMinutes: breakdown.pauseAfterMinutes,
        pauseBeforeMinutes: breakdown.pauseBeforeMinutes,
        routeDurationMinutes: breakdown.routeDurationMinutes,
        sequenceIndex,
        startMinutes,
        startTime: startMinutes === null ? null : formatClockMinutes(startMinutes),
        stops,
        to: journey?.to || '*',
      })

      if (orderStartMinutes === null && startMinutes !== null) {
        orderStartMinutes = startMinutes
      }
      if (consumedEndMinutes !== null) {
        orderEndMinutes = consumedEndMinutes
      }

      if (currentTimeMinutes !== null && breakdown.isResolvable) {
        currentTimeMinutes = normalizeMinutePrecision(currentTimeMinutes + breakdown.totalMinutes)
      } else if (!breakdown.isResolvable) {
        currentTimeMinutes = null
      }
    }
  }

  for (let nodeIndex = 0; nodeIndex < order.nodes.length; nodeIndex += 1) {
    const node = order.nodes[nodeIndex]

    if (node?.kind === 'time') {
      currentTimeMinutes = resolveTimeNodeClockMinutes(node, currentTimeMinutes)
      if (orderStartMinutes === null && currentTimeMinutes !== null) {
        orderStartMinutes = currentTimeMinutes
      }
      continue
    }

    if (!node) {
      continue
    }

    if (node.loopUntil && currentTimeMinutes !== null) {
      const loopUntilMinutes = resolveLoopUntilClockMinutes(node.loopUntil, currentTimeMinutes)

      if (loopUntilMinutes !== null) {
        let cycleIndex = 0
        while (true) {
          if (node.journeyIds.length === 0) {
            break
          }

          const cycleStartMinutes: number | null = currentTimeMinutes
          pushJourneyCycle(nodeIndex, cycleIndex, node.journeyIds)

          if (currentTimeMinutes === null || cycleStartMinutes === currentTimeMinutes) {
            break
          }

          cycleIndex += 1
          if (currentTimeMinutes >= loopUntilMinutes) {
            break
          }
        }

        continue
      }
    }

    pushJourneyCycle(nodeIndex, 0, node.journeyIds)
  }

  const totalDurationMinutes = normalizeMinutePrecision(segments.reduce((total, segment) => total + segment.durationMinutes, 0))

  return {
    endMinutes: orderEndMinutes,
    endTime: orderEndMinutes === null ? null : formatClockMinutes(orderEndMinutes),
    orderId: order.id,
    orderNumber: order.orderNumber,
    segments,
    startMinutes: orderStartMinutes,
    startTime: orderStartMinutes === null ? null : formatClockMinutes(orderStartMinutes),
    totalDurationMinutes,
  }
}