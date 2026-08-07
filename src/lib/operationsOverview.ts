import { inferLineDisplayValue } from './document'
import { findBestRouteMatch, getDisplayLinePreview } from './referenceModules'
import { buildShiftOrderTimeline, formatClockMinutesRoundedDown } from './shiftTiming'
import type { DisplayLinePreview, ImportedRouteDefinition, ShiftDocument } from '../types'

export interface OperationsStopOption {
  departureCount: number
  firstDepartureTime: string | null
  key: string
  label: string
  lastDepartureTime: string | null
  platformCount: number
  platforms: string[]
  stopName: string
}

export interface OperationsDeparture {
  departureMinutes: number
  departureTime: string
  direction: string
  hour: number
  id: string
  journeyKey: string
  lineDisplayPreview: DisplayLinePreview | null
  lineDisplayText: string
  minute: number
  orderNumber: number
  platform: string
  stopKey: string
  stopLabel: string
  stopName: string
}

export interface OperationsOverviewData {
  departures: OperationsDeparture[]
  stopOptions: OperationsStopOption[]
}

function getStopKey(stopName: string) {
  return stopName
}

function getStopLabel(stopName: string) {
  return stopName
}

function getStopPlatformLabel(stopName: string, platform: string) {
  return platform ? `${stopName} / ${platform}` : stopName
}

function getMinuteOfDay(absoluteMinutes: number) {
  return (((absoluteMinutes % 1440) + 1440) % 1440)
}

function sortPlatforms(platforms: string[]) {
  return [...platforms].sort((left, right) => {
    if (!left && !right) {
      return 0
    }

    if (!left) {
      return 1
    }

    if (!right) {
      return -1
    }

    return left.localeCompare(right, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  })
}

function buildFallbackDisplayLinePreview(lineDisplayText: string): DisplayLinePreview {
  const normalizedLineDisplay = inferLineDisplayValue(lineDisplayText)
  const text = normalizedLineDisplay.kind === 'nil' ? '/' : normalizedLineDisplay.value

  return {
    text,
    textColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(166, 171, 180)',
    isRounded: Boolean(Number(text)) && text.length === 1,
  }
}

export function buildOperationsOverviewData(documents: ShiftDocument | ShiftDocument[], routes: ImportedRouteDefinition[]): OperationsOverviewData {
  const sourceDocuments = Array.isArray(documents) ? documents : [documents]
  const departures: OperationsDeparture[] = []
  const stopSummaryByKey = new Map<string, {
    departureCount: number
    firstDepartureMinutes: number
    firstDepartureTime: string
    key: string
    label: string
    lastDepartureMinutes: number
    lastDepartureTime: string
    platformSet: Set<string>
    stopName: string
  }>()

  for (let documentIndex = 0; documentIndex < sourceDocuments.length; documentIndex += 1) {
    const sourceDocument = sourceDocuments[documentIndex]
    const sortedShiftOrders = [...sourceDocument.shiftOrders].sort((left, right) => left.orderNumber - right.orderNumber)
    const journeysById = new Map(sourceDocument.journeys.map((journey) => [journey.id, journey]))

    for (const order of sortedShiftOrders) {
      const timeline = buildShiftOrderTimeline(order, sourceDocument.journeys, routes)

      for (const segment of timeline.segments) {
        const journey = journeysById.get(segment.journeyId) ?? null
        const routeMatch = journey ? findBestRouteMatch(journey, routes) : null
        const lineDisplayPreview = journey
          ? getDisplayLinePreview(journey, routeMatch) ?? buildFallbackDisplayLinePreview(segment.lineDisplay)
          : buildFallbackDisplayLinePreview(segment.lineDisplay)
        const lineDisplayText = lineDisplayPreview.text || '/'
        const finalStop = segment.stops.at(-1)
        const direction = finalStop?.stopName || segment.to || '(Destination)'

        for (let stopIndex = 0; stopIndex < segment.stops.length; stopIndex += 1) {
          const stop = segment.stops[stopIndex]
          if (!stop?.stopName || stop.absoluteMinutes === null || !stop.time) {
            continue
          }

          const departureMinutes = getMinuteOfDay(stop.absoluteMinutes)
          const stopKey = getStopKey(stop.stopName)
          const stopLabel = getStopPlatformLabel(stop.stopName, stop.platform)
          const departure: OperationsDeparture = {
            departureMinutes: stop.absoluteMinutes,
            departureTime: formatClockMinutesRoundedDown(stop.absoluteMinutes),
            direction,
            hour: Math.floor(departureMinutes / 60),
            id: `${documentIndex}-${order.id}-${segment.nodeIndex}-${segment.cycleIndex}-${segment.sequenceIndex}-${stopIndex}`,
            journeyKey: segment.journeyKey,
            lineDisplayPreview,
            lineDisplayText,
            minute: departureMinutes % 60,
            orderNumber: order.orderNumber,
            platform: stop.platform,
            stopKey,
            stopLabel,
            stopName: stop.stopName,
          }

          departures.push(departure)

          const existingStopSummary = stopSummaryByKey.get(stopKey)
          if (!existingStopSummary) {
            stopSummaryByKey.set(stopKey, {
              departureCount: 1,
              firstDepartureMinutes: stop.absoluteMinutes,
              firstDepartureTime: formatClockMinutesRoundedDown(stop.absoluteMinutes),
              key: stopKey,
              label: getStopLabel(stop.stopName),
              lastDepartureMinutes: stop.absoluteMinutes,
              lastDepartureTime: formatClockMinutesRoundedDown(stop.absoluteMinutes),
              platformSet: new Set([stop.platform]),
              stopName: stop.stopName,
            })
            continue
          }

          existingStopSummary.departureCount += 1
          if (stop.absoluteMinutes < existingStopSummary.firstDepartureMinutes) {
            existingStopSummary.firstDepartureMinutes = stop.absoluteMinutes
            existingStopSummary.firstDepartureTime = formatClockMinutesRoundedDown(stop.absoluteMinutes)
          }
          if (stop.absoluteMinutes > existingStopSummary.lastDepartureMinutes) {
            existingStopSummary.lastDepartureMinutes = stop.absoluteMinutes
            existingStopSummary.lastDepartureTime = formatClockMinutesRoundedDown(stop.absoluteMinutes)
          }
          existingStopSummary.platformSet.add(stop.platform)
        }
      }
    }
  }

  departures.sort((left, right) => {
    if (left.departureMinutes !== right.departureMinutes) {
      return left.departureMinutes - right.departureMinutes
    }

    if (left.platform !== right.platform) {
      return left.platform.localeCompare(right.platform, undefined, { numeric: true, sensitivity: 'base' })
    }

    if (left.lineDisplayText !== right.lineDisplayText) {
      return left.lineDisplayText.localeCompare(right.lineDisplayText, undefined, { numeric: true, sensitivity: 'base' })
    }

    return left.direction.localeCompare(right.direction, undefined, { sensitivity: 'base' })
  })

  const stopOptions = [...stopSummaryByKey.values()].map((stopSummary) => ({
    departureCount: stopSummary.departureCount,
    firstDepartureTime: stopSummary.firstDepartureTime,
    key: stopSummary.key,
    label: stopSummary.label,
    lastDepartureTime: stopSummary.lastDepartureTime,
    platformCount: stopSummary.platformSet.size,
    platforms: sortPlatforms([...stopSummary.platformSet]),
    stopName: stopSummary.stopName,
  })).sort((left, right) => {
    const stopNameComparison = left.stopName.localeCompare(right.stopName, undefined, { sensitivity: 'base' })
    if (stopNameComparison !== 0) {
      return stopNameComparison
    }

    return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
  })

  return {
    departures,
    stopOptions,
  }
}