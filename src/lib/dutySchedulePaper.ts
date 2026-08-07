import { findBestRouteMatch, getDisplayLinePreview } from './referenceModules'
import { buildShiftOrderTimeline, type ShiftOrderTimelineSegment } from './shiftTiming'
import type { DisplayLinePreview, ImportedRouteDefinition, JourneyDefinition, ShiftOrder } from '../types'

export interface DutyPaperStopOption {
  key: string
  label: string
  platform: string
  stopName: string
}

export interface DutyPaperTripColumn {
  endStopKey: string | null
  endTime: string | null
  id: string
  journeyKey: string
  lineDisplay: string
  originStopKey: string | null
  startTime: string | null
  subtitle: string
  timesByStopKey: Record<string, string>
  title: string
}

export interface DutySchedulePaperPreview {
  defaultSelectedStopKeys: string[]
  endsWithSummary: string | null
  lineDisplayPreview: DisplayLinePreview | null
  lineDisplayText: string
  startsWithSummary: string | null
  stopOptions: DutyPaperStopOption[]
  tripColumns: DutyPaperTripColumn[]
}

function getStopKey(stopName: string, platform: string) {
  return `${stopName}::${platform}`
}

function getStopLabel(stopName: string, platform: string) {
  return platform ? `${stopName} / ${platform}` : stopName
}

function getPrimaryLineDisplay(segments: ShiftOrderTimelineSegment[]) {
  const displayCounts = new Map<string, { count: number, firstIndex: number }>()

  for (let index = 0; index < segments.length; index += 1) {
    const lineDisplay = segments[index]?.lineDisplay?.trim()
    if (!lineDisplay || lineDisplay === 'nil') {
      continue
    }

    const existingEntry = displayCounts.get(lineDisplay)
    if (existingEntry) {
      existingEntry.count += 1
      continue
    }

    displayCounts.set(lineDisplay, {
      count: 1,
      firstIndex: index,
    })
  }

  const rankedDisplays = [...displayCounts.entries()].sort((left, right) => {
    if (right[1].count !== left[1].count) {
      return right[1].count - left[1].count
    }

    return left[1].firstIndex - right[1].firstIndex
  })

  return rankedDisplays[0]?.[0] ?? '?'
}

function getDefaultSelectedStopKeys(stopOptions: DutyPaperStopOption[]) {
  if (stopOptions.length <= 3) {
    return stopOptions.map((stopOption) => stopOption.key)
  }

  const selectedIndexes = new Set<number>([
    0,
    Math.floor((stopOptions.length - 1) / 2),
    stopOptions.length - 1,
  ])

  return [...selectedIndexes]
    .sort((left, right) => left - right)
    .map((index) => stopOptions[index]!.key)
}

function getSegmentSummary(segment: ShiftOrderTimelineSegment | undefined) {
  if (!segment) {
    return null
  }

  const firstStop = segment.stops[0]
  const lastStop = segment.stops.at(-1)
  if (!firstStop || !lastStop) {
    return null
  }

  return `${firstStop.time ?? '--'} ${getStopLabel(firstStop.stopName || segment.from || '*', firstStop.platform)} -> ${lastStop.time ?? '--'} ${getStopLabel(lastStop.stopName || segment.to || '*', lastStop.platform)}`
}

function getTripTitle(segment: ShiftOrderTimelineSegment) {
  const firstStop = segment.stops[0]
  const lastStop = segment.stops.at(-1)
  const fromLabel = firstStop?.stopName || segment.from || '*'
  const toLabel = lastStop?.stopName || segment.to || '*'

  return `${fromLabel} -> ${toLabel}`
}

function buildFallbackDisplayLinePreview(lineDisplayText: string): DisplayLinePreview {
  return {
    text: lineDisplayText || '/',
    textColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(166, 171, 180)',
    isRounded: Boolean(Number(lineDisplayText)) && lineDisplayText.length === 1,
  }
}

function getLineDisplayPreview(timeline: ReturnType<typeof buildShiftOrderTimeline>, journeys: JourneyDefinition[], routes: ImportedRouteDefinition[], lineDisplayText: string) {
  const journeysById = new Map(journeys.map((journey) => [journey.id, journey]))
  const representativeJourney = timeline.segments.reduce<JourneyDefinition | null>((foundJourney, segment) => {
    if (foundJourney) {
      return foundJourney
    }

    return journeysById.get(segment.journeyId) ?? null
  }, null) ?? journeys[0] ?? null

  if (!representativeJourney) {
    return buildFallbackDisplayLinePreview(lineDisplayText)
  }

  return getDisplayLinePreview(representativeJourney, findBestRouteMatch(representativeJourney, routes))
    ?? buildFallbackDisplayLinePreview(lineDisplayText)
}

export function buildDutySchedulePaperPreview(
  order: ShiftOrder,
  journeys: JourneyDefinition[],
  routes: ImportedRouteDefinition[],
): DutySchedulePaperPreview {
  const timeline = buildShiftOrderTimeline(order, journeys, routes)
  const stopOptions: DutyPaperStopOption[] = []
  const seenStopKeys = new Set<string>()

  for (const segment of timeline.segments) {
    for (const stop of segment.stops) {
      if (!stop.stopName) {
        continue
      }

      const stopKey = getStopKey(stop.stopName, stop.platform)
      if (seenStopKeys.has(stopKey)) {
        continue
      }

      seenStopKeys.add(stopKey)
      stopOptions.push({
        key: stopKey,
        label: getStopLabel(stop.stopName, stop.platform),
        platform: stop.platform,
        stopName: stop.stopName,
      })
    }
  }

  const tripColumns = timeline.segments.map((segment, segmentIndex) => {
    const timesByStopKey: Record<string, string> = {}

    for (const stop of segment.stops) {
      if (!stop.stopName || !stop.time) {
        continue
      }

      timesByStopKey[getStopKey(stop.stopName, stop.platform)] = stop.time
    }

    const originStop = segment.stops[0]
    const endStop = segment.stops.at(-1)

    return {
      endStopKey: endStop ? getStopKey(endStop.stopName, endStop.platform) : null,
      endTime: segment.endTime,
      id: `${segment.nodeIndex}-${segment.cycleIndex}-${segment.sequenceIndex}-${segmentIndex}`,
      journeyKey: segment.journeyKey,
      lineDisplay: segment.lineDisplay,
      originStopKey: originStop ? getStopKey(originStop.stopName, originStop.platform) : null,
      startTime: segment.startTime,
      subtitle: `${segment.startTime ?? '--'} - ${segment.endTime ?? '--'}`,
      timesByStopKey,
      title: getTripTitle(segment),
    } satisfies DutyPaperTripColumn
  })

  return {
    defaultSelectedStopKeys: getDefaultSelectedStopKeys(stopOptions),
    endsWithSummary: getSegmentSummary(timeline.segments.at(-1)),
    lineDisplayPreview: getLineDisplayPreview(timeline, journeys, routes, getPrimaryLineDisplay(timeline.segments)),
    lineDisplayText: getPrimaryLineDisplay(timeline.segments),
    startsWithSummary: getSegmentSummary(timeline.segments[0]),
    stopOptions,
    tripColumns,
  }
}