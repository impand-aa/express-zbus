import { buildShiftOrderTimeline, formatClockMinutes, getJourneyRuntimeInfo } from './shiftTiming'
import type { ImportedRouteDefinition, JourneyDefinition, ShiftOrder } from '../types'

export type SubstituteServicePreviewStatus = 'good' | 'warning' | 'impossible'

export interface SubstituteDutyTemplateInput {
  dutyLabel?: string
  interchangeKey?: string
  journeyIds: string[]
}

export interface SubstituteTemplateInterchangeOption {
  key: string
  label: string
  leadMinutes: number
  platform: string
  stopName: string
}

export interface SubstituteBaseOrderPreview {
  endTime: string | null
  orderId: string
  orderNumber: number
  startMinutes: number | null
  startTime: string | null
}

export interface SubstituteDutyAssignmentPreview {
  availableBreakMinutes: number | null
  baseAnchorTime: string | null
  baseOrderStartTime: string | null
  finalStartTime: string | null
  gapMinutes: number | null
  matchedPlatform: string | null
  matchedStopName: string | null
  nextOrderNumber: number | null
  orderId: string
  orderNumber: number
  startTime: string | null
}

export interface SubstituteDutyPreview {
  assignedOrders: SubstituteDutyAssignmentPreview[]
  coverageOrderNumbers: number[]
  runtimeMinutes: number | null
  dutyIndex: number
  dutyLabel: string
  selectedInterchangeLabel: string | null
  selectedJourneyKeys: string[]
  status: SubstituteServicePreviewStatus
  warnings: string[]
}

export interface SubstituteServiceDemoPreview {
  averageHeadwayMinutes: number | null
  baseOrders: SubstituteBaseOrderPreview[]
  dutyPreviews: SubstituteDutyPreview[]
  maxHeadwayMinutes: number | null
  minHeadwayMinutes: number | null
  overallMessage: string
  overallStatus: SubstituteServicePreviewStatus
  serviceEndTime: string | null
  serviceStartTime: string | null
}

export interface BuildSubstituteServiceDemoPreviewOptions {
  baseJourneys?: JourneyDefinition[]
  journeys: JourneyDefinition[]
  maxDesiredBreakMinutes: number
  minBreakMinutes: number
  routes: ImportedRouteDefinition[]
  shiftOrders: ShiftOrder[]
  templates: SubstituteDutyTemplateInput[]
}

interface ResolvedBaseOrderPreview extends SubstituteBaseOrderPreview {
  timeline: ReturnType<typeof buildShiftOrderTimeline>
}

interface TemplateAnchorInfo {
  leadMinutes: number | null
  platform: string | null
  stopName: string | null
}

interface DraftDutyAssignmentPreview {
  baseAnchorTime: string | null
  baseOrderStartTime: string | null
  finalStartMinutes: number | null
  finalStartTime: string | null
  matchedPlatform: string | null
  matchedStopName: string | null
  orderId: string
  orderNumber: number
  recurrenceMinutes: number | null
  startMinutes: number | null
  startTime: string | null
}

interface AnchorOccurrence {
  absoluteMinutes: number
  cycleIndex: number
}

function getDutyLabel(index: number) {
  return `Duty ${String.fromCharCode(65 + index)}`
}

function getRoundedAverage(values: number[]) {
  if (values.length === 0) {
    return null
  }

  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10
}

function normalizeStopName(value: string) {
  return value.trim().toLowerCase()
}

function normalizePlatform(value: string) {
  return value.trim().toLowerCase()
}

function getInterchangeKey(stopName: string, platform: string) {
  return `${stopName}__${platform}`
}

export function getTemplateInterchangeOptions(
  journeyIds: string[],
  journeys: JourneyDefinition[],
  routes: ImportedRouteDefinition[],
) {
  if (journeyIds.length === 0) {
    return []
  }

  const previewOrder: ShiftOrder = {
    id: 'substitute-demo-preview-order',
    orderNumber: 0,
    nodes: [
      {
        id: 'substitute-demo-preview-time-node',
        kind: 'time',
        time: '00:00',
      },
      {
        id: 'substitute-demo-preview-journey-node',
        kind: 'journeys',
        journeyIds,
        loopUntil: '',
      },
    ],
  }
  const timeline = buildShiftOrderTimeline(previewOrder, journeys, routes)
  const options: SubstituteTemplateInterchangeOption[] = []
  const seenKeys = new Set<string>()

  for (const stop of timeline.segments.flatMap((segment) => segment.stops)) {
    if (stop.absoluteMinutes === null || stop.stopName.trim().length === 0) {
      continue
    }

    const platform = stop.platform ?? ''
    const key = getInterchangeKey(stop.stopName, platform)
    if (seenKeys.has(key)) {
      continue
    }

    seenKeys.add(key)
    options.push({
      key,
      label: platform ? `${stop.stopName} / ${platform}` : stop.stopName,
      leadMinutes: stop.absoluteMinutes,
      platform,
      stopName: stop.stopName,
    })
  }

  return options
}

function findMatchingStop(
  stops: Array<{ absoluteMinutes: number | null, platform: string, stopName: string, time: string | null }>,
  anchorStopName: string,
  anchorPlatform: string | null,
) {
  const exactMatch = anchorPlatform
    ? stops.find((stop) => (
      stop.absoluteMinutes !== null &&
      normalizeStopName(stop.stopName) === normalizeStopName(anchorStopName) &&
      normalizePlatform(stop.platform) === normalizePlatform(anchorPlatform)
    ))
    : null

  if (exactMatch) {
    return exactMatch
  }

  return stops.find((stop) => (
    stop.absoluteMinutes !== null &&
    normalizeStopName(stop.stopName) === normalizeStopName(anchorStopName)
  )) ?? null
}

function findLastMatchingStop(
  stops: Array<{ absoluteMinutes: number | null, platform: string, stopName: string, time: string | null }>,
  anchorStopName: string,
  anchorPlatform: string | null,
) {
  const exactMatches = anchorPlatform
    ? stops.filter((stop) => (
      stop.absoluteMinutes !== null &&
      normalizeStopName(stop.stopName) === normalizeStopName(anchorStopName) &&
      normalizePlatform(stop.platform) === normalizePlatform(anchorPlatform)
    ))
    : []

  if (exactMatches.length > 0) {
    return exactMatches.at(-1) ?? null
  }

  const stopNameMatches = stops.filter((stop) => (
    stop.absoluteMinutes !== null &&
    normalizeStopName(stop.stopName) === normalizeStopName(anchorStopName)
  ))

  return stopNameMatches.at(-1) ?? null
}

function getTemplateAnchorInfo(
  journeyIds: string[],
  journeys: JourneyDefinition[],
  routes: ImportedRouteDefinition[],
  preferredInterchangeKey?: string,
): TemplateAnchorInfo {
  const options = getTemplateInterchangeOptions(journeyIds, journeys, routes)
  const selectedOption = options.find((option) => option.key === preferredInterchangeKey) ?? options[0]

  if (!selectedOption) {
    return {
      leadMinutes: null,
      platform: null,
      stopName: null,
    }
  }

  return {
    leadMinutes: selectedOption.leadMinutes,
    platform: selectedOption.platform || null,
    stopName: selectedOption.stopName,
  }
}

function getRecurringAnchorGapMinutes(
  orderTimeline: ReturnType<typeof buildShiftOrderTimeline>,
  anchorStopName: string | null,
  anchorPlatform: string | null,
) {
  if (!anchorStopName) {
    return null
  }

  const anchorOccurrences: AnchorOccurrence[] = orderTimeline.segments.flatMap((segment) => segment.stops.flatMap((stop) => {
    if (stop.absoluteMinutes === null) {
      return []
    }

    const exactPlatformMatch = anchorPlatform && normalizePlatform(stop.platform) === normalizePlatform(anchorPlatform)
    const sameStopName = normalizeStopName(stop.stopName) === normalizeStopName(anchorStopName)

    if (!sameStopName) {
      return []
    }

    if (anchorPlatform && !exactPlatformMatch) {
      return []
    }

    return [{
      absoluteMinutes: stop.absoluteMinutes,
      cycleIndex: segment.cycleIndex,
    }]
  }))

  const fallbackOccurrences = anchorOccurrences.length > 0
    ? anchorOccurrences
    : orderTimeline.segments.flatMap((segment) => segment.stops.flatMap((stop) => {
      if (stop.absoluteMinutes === null) {
        return []
      }

      if (normalizeStopName(stop.stopName) !== normalizeStopName(anchorStopName)) {
        return []
      }

      return [{
        absoluteMinutes: stop.absoluteMinutes,
        cycleIndex: segment.cycleIndex,
      }]
    }))

  const firstOccurrence = fallbackOccurrences[0]
  if (!firstOccurrence) {
    return null
  }

  const nextCycleOccurrence = fallbackOccurrences.find((occurrence) => occurrence.cycleIndex > firstOccurrence.cycleIndex)
  if (!nextCycleOccurrence) {
    return null
  }

  return nextCycleOccurrence.absoluteMinutes - firstOccurrence.absoluteMinutes
}

export function buildSubstituteServiceDemoPreview({
  baseJourneys,
  journeys,
  maxDesiredBreakMinutes,
  minBreakMinutes,
  routes,
  shiftOrders,
  templates,
}: BuildSubstituteServiceDemoPreviewOptions): SubstituteServiceDemoPreview {
  const journeysById = new Map(journeys.map((journey) => [journey.id, journey]))
  const baseJourneyList = baseJourneys ?? journeys
  const baseOrders: ResolvedBaseOrderPreview[] = shiftOrders
    .map((order) => {
      const timeline = buildShiftOrderTimeline(order, baseJourneyList, routes)
      return {
        endTime: timeline.endTime,
        orderId: order.id,
        orderNumber: order.orderNumber,
        startMinutes: timeline.startMinutes,
        startTime: timeline.startTime,
        timeline,
      }
    })
    .sort((left, right) => {
      if (left.startMinutes === null && right.startMinutes === null) {
        return left.orderNumber - right.orderNumber
      }

      if (left.startMinutes === null) {
        return 1
      }

      if (right.startMinutes === null) {
        return -1
      }

      return left.startMinutes - right.startMinutes || left.orderNumber - right.orderNumber
    })

  const resolvedBaseOrders = baseOrders.filter((order) => order.startMinutes !== null)
  const headways: number[] = []
  for (let index = 1; index < resolvedBaseOrders.length; index += 1) {
    const currentOrder = resolvedBaseOrders[index]
    const previousOrder = resolvedBaseOrders[index - 1]
    if (currentOrder?.startMinutes !== null && previousOrder?.startMinutes !== null) {
      headways.push(currentOrder.startMinutes - previousOrder.startMinutes)
    }
  }

  const dutyPreviews = templates.map((template, dutyIndex) => {
    const assignedBaseOrders = resolvedBaseOrders.filter((_, orderIndex) => orderIndex % Math.max(templates.length, 1) === dutyIndex)
    const selectedJourneyKeys = template.journeyIds.map((journeyId) => journeysById.get(journeyId)?.key ?? '(missing journey)')
    const templateAnchor = getTemplateAnchorInfo(template.journeyIds, journeys, routes, template.interchangeKey)
    const interchangeOptions = getTemplateInterchangeOptions(template.journeyIds, journeys, routes)
    const selectedInterchangeOption = interchangeOptions.find((option) => option.key === template.interchangeKey) ?? interchangeOptions[0] ?? null
    const journeyDurations = template.journeyIds.map((journeyId) => {
      const journey = journeysById.get(journeyId)
      return journey ? getJourneyRuntimeInfo(journey, routes) : null
    })
    const hasUnknownDuration = journeyDurations.some((journeyDuration) => journeyDuration === null || !journeyDuration.isResolvable)
    const runtimeMinutes = hasUnknownDuration
      ? null
      : journeyDurations.reduce((total, journeyDuration) => total + (journeyDuration?.totalMinutes ?? 0), 0)
    const warnings: string[] = []

    if (assignedBaseOrders.length === 0) {
      warnings.push('No base orders are assigned to this duty under the current split.')
    }

    if (runtimeMinutes === null) {
      warnings.push('At least one selected journey runtime could not be resolved from current journey data.')
    }

    if (templateAnchor.stopName === null || templateAnchor.leadMinutes === null) {
      warnings.push('Could not derive a coverage anchor stop from the selected substitute legs.')
    }

    const draftAssignments: DraftDutyAssignmentPreview[] = assignedBaseOrders.map((order) => {
      const baseStops = order.timeline.segments.flatMap((segment) => segment.stops)
      const anchorStopName = templateAnchor.stopName
      const matchedStop = anchorStopName
        ? findMatchingStop(baseStops, anchorStopName, templateAnchor.platform)
        : null
      const lastMatchedStop = anchorStopName
        ? findLastMatchingStop(baseStops, anchorStopName, templateAnchor.platform)
        : null
      const suggestedStartMinutes = matchedStop?.absoluteMinutes != null && templateAnchor.leadMinutes !== null
        ? matchedStop.absoluteMinutes - templateAnchor.leadMinutes
        : order.startMinutes
      const finalSuggestedStartMinutes = lastMatchedStop?.absoluteMinutes != null && templateAnchor.leadMinutes !== null
        ? lastMatchedStop.absoluteMinutes - templateAnchor.leadMinutes
        : suggestedStartMinutes

      if (templateAnchor.stopName && baseStops.length > 0 && !matchedStop) {
        warnings.push(`Base order ${order.orderNumber} does not reach ${templateAnchor.stopName}; using the raw order start as a fallback.`)
      }

      return {
        baseAnchorTime: matchedStop?.time ?? order.startTime,
        baseOrderStartTime: order.startTime,
        finalStartMinutes: finalSuggestedStartMinutes,
        finalStartTime: finalSuggestedStartMinutes === null ? null : formatClockMinutes(finalSuggestedStartMinutes),
        matchedPlatform: matchedStop?.platform ?? templateAnchor.platform,
        matchedStopName: matchedStop?.stopName ?? templateAnchor.stopName,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        recurrenceMinutes: getRecurringAnchorGapMinutes(
          order.timeline,
          matchedStop?.stopName ?? templateAnchor.stopName,
          matchedStop?.platform ?? templateAnchor.platform,
        ),
        startMinutes: suggestedStartMinutes,
        startTime: suggestedStartMinutes === null ? null : formatClockMinutes(suggestedStartMinutes),
      }
    })

    const assignedOrders = draftAssignments.map((assignment, orderIndex) => {
      const nextOccurrence = assignment.startMinutes === null
        ? null
        : draftAssignments.reduce<{ nextOrderNumber: number, startMinutes: number } | null>((bestCandidate, candidate, candidateIndex) => {
          const candidateStarts: Array<{ nextOrderNumber: number, startMinutes: number }> = []

          if (candidateIndex > orderIndex && candidate.startMinutes !== null) {
            candidateStarts.push({
              nextOrderNumber: candidate.orderNumber,
              startMinutes: candidate.startMinutes,
            })
          }

          if (candidate.startMinutes !== null && candidate.recurrenceMinutes !== null) {
            candidateStarts.push({
              nextOrderNumber: candidate.orderNumber,
              startMinutes: candidate.startMinutes + candidate.recurrenceMinutes,
            })
          }

          const nextCandidate = candidateStarts
            .filter((candidateStart) => candidateStart.startMinutes > assignment.startMinutes!)
            .sort((left, right) => left.startMinutes - right.startMinutes)[0] ?? null

          if (!nextCandidate) {
            return bestCandidate
          }

          if (!bestCandidate || nextCandidate.startMinutes < bestCandidate.startMinutes) {
            return nextCandidate
          }

          return bestCandidate
        }, null)
      const gapMinutes = nextOccurrence && assignment.startMinutes !== null
        ? nextOccurrence.startMinutes - assignment.startMinutes
        : null
      const availableBreakMinutes = gapMinutes !== null && runtimeMinutes !== null
        ? gapMinutes - runtimeMinutes
        : null

      if (availableBreakMinutes !== null && availableBreakMinutes < minBreakMinutes) {
        warnings.push(
          `Order ${assignment.orderNumber}${nextOccurrence ? ` to ${nextOccurrence.nextOrderNumber}` : ''} leaves only ${availableBreakMinutes} min before the next assigned departure.`,
        )
      } else if (
        availableBreakMinutes !== null &&
        maxDesiredBreakMinutes > 0 &&
        availableBreakMinutes > maxDesiredBreakMinutes
      ) {
        warnings.push(
          `Order ${assignment.orderNumber}${nextOccurrence ? ` to ${nextOccurrence.nextOrderNumber}` : ''} leaves ${availableBreakMinutes} min of idle time.`,
        )
      }

      return {
        availableBreakMinutes,
        baseAnchorTime: assignment.baseAnchorTime,
        baseOrderStartTime: assignment.baseOrderStartTime,
        finalStartTime: assignment.finalStartTime,
        gapMinutes,
        matchedPlatform: assignment.matchedPlatform,
        matchedStopName: assignment.matchedStopName,
        nextOrderNumber: nextOccurrence?.nextOrderNumber ?? null,
        orderId: assignment.orderId,
        orderNumber: assignment.orderNumber,
        startTime: assignment.startTime,
      } satisfies SubstituteDutyAssignmentPreview
    })

    const status: SubstituteServicePreviewStatus = warnings.some((warning) => warning.includes('only') || warning.includes('could not be resolved'))
      ? 'impossible'
      : warnings.length > 0
        ? 'warning'
        : 'good'

    return {
      assignedOrders,
      coverageOrderNumbers: assignedBaseOrders.map((order) => order.orderNumber),
      runtimeMinutes,
      dutyIndex,
      dutyLabel: template.dutyLabel || getDutyLabel(dutyIndex),
      selectedInterchangeLabel: selectedInterchangeOption?.label ?? null,
      selectedJourneyKeys,
      status,
      warnings,
    } satisfies SubstituteDutyPreview
  })

  const overallStatus: SubstituteServicePreviewStatus = dutyPreviews.some((preview) => preview.status === 'impossible')
    ? 'impossible'
    : dutyPreviews.some((preview) => preview.status === 'warning')
      ? 'warning'
      : 'good'

  const overallMessage = resolvedBaseOrders.length === 0
    ? 'Add valid start times to the base shift orders before using the substitute-service planner.'
    : overallStatus === 'impossible'
      ? 'The current split cannot preserve the requested minimum break on every assigned handoff.'
      : overallStatus === 'warning'
        ? 'The current split is workable, but some duties are left with more idle time than requested.'
        : 'The current split preserves the requested minimum break across assigned base duties.'

  return {
    averageHeadwayMinutes: getRoundedAverage(headways),
    baseOrders,
    dutyPreviews,
    maxHeadwayMinutes: headways.length > 0 ? Math.max(...headways) : null,
    minHeadwayMinutes: headways.length > 0 ? Math.min(...headways) : null,
    overallMessage,
    overallStatus,
    serviceEndTime: [...baseOrders].reverse().find((order) => order.endTime)?.endTime ?? baseOrders.at(-1)?.startTime ?? null,
    serviceStartTime: baseOrders.find((order) => order.startTime)?.startTime ?? null,
  }
}