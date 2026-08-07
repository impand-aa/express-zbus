import {
  buildUniqueJourneyKey,
  cloneJourneyOrderRows,
  createJourney,
  createJourneyNode,
  createShiftOrder,
  createTimeNode,
  getNextShiftOrderNumber,
} from './document'
import { formatClockMinutes, getJourneyDurationInfo } from './shiftTiming'
import {
  buildSubstituteServiceDemoPreview,
  getTemplateInterchangeOptions,
  type BuildSubstituteServiceDemoPreviewOptions,
  type SubstituteDutyTemplateInput,
  type SubstituteServiceDemoPreview,
  type SubstituteServicePreviewStatus,
  type SubstituteTemplateInterchangeOption,
} from './substituteServiceDemo'
import type { ImportedRouteDefinition, JourneyDefinition, ShiftDocument, ShiftOrder } from '../types'

export type BuildSubstituteServicePlannerPreviewOptions = BuildSubstituteServiceDemoPreviewOptions
export type SubstituteServicePlannerPreview = SubstituteServiceDemoPreview

export interface SubstitutePlannerJourneyOption {
  id: string
  journey: JourneyDefinition
  source: 'current' | 'reference'
}

export interface AppendSubstituteServicePlanOptions {
  document: ShiftDocument
  journeyOptions: SubstitutePlannerJourneyOption[]
  preview: SubstituteServicePlannerPreview
  routes: ImportedRouteDefinition[]
  templates: SubstituteDutyTemplateInput[]
}

export interface PlannedJourneyChange {
  dutyLabel: string | null
  kind: 'current-retime' | 'reference-import' | 'loop-clone' | 'loop-retimed-clone'
  pauseBeforeJourneyAfter: string
  pauseBeforeJourneyBefore: string
  resultingJourneyKey: string
  sourceJourneyKey: string
}

export interface AppendedSubstituteServicePlan {
  createdOrders: ShiftOrder[]
  document: ShiftDocument
  firstCreatedOrderId: string | null
  importedJourneys: JourneyDefinition[]
  journeyChanges: PlannedJourneyChange[]
  warnings: string[]
}

function parseClockMinutes(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!match) {
    return null
  }

  return (Number(match[1]) * 60) + Number(match[2])
}

function parseMinuteValue(value: string) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function formatPauseValue(totalMinutes: number) {
  return totalMinutes <= 0 ? '' : String(totalMinutes)
}

function cloneJourneyDefinition(journey: JourneyDefinition, journeys: JourneyDefinition[]) {
  return createJourney({
    key: buildUniqueJourneyKey(journeys, journey.key),
    lineDisplay: { ...journey.lineDisplay },
    from: journey.from,
    to: journey.to,
    pauseBeforeJourney: journey.pauseBeforeJourney,
    pauseAfterJourney: journey.pauseAfterJourney,
    orders: cloneJourneyOrderRows(journey.orders),
  })
}

function getRegularLoopGapMinutes(validAssignments: Array<{
  gapMinutes: number | null
  startMinutes: number | null
}>) {
  if (validAssignments.length === 0) {
    return null
  }

  if (validAssignments.length === 1) {
    return validAssignments[0]?.gapMinutes ?? null
  }

  const recurrenceGapMinutes = validAssignments[1]!.startMinutes! - validAssignments[0]!.startMinutes!
  const hasRegularGap = validAssignments.slice(1).every((assignment, assignmentIndex) => (
    assignment.startMinutes! - validAssignments[assignmentIndex]!.startMinutes! === recurrenceGapMinutes
  ))

  return hasRegularGap ? recurrenceGapMinutes : null
}

export const buildSubstituteServicePlannerPreview = buildSubstituteServiceDemoPreview
export { getTemplateInterchangeOptions }
export type {
  SubstituteDutyTemplateInput,
  SubstituteServicePreviewStatus,
  SubstituteTemplateInterchangeOption,
}

export function appendSubstituteServicePlan({
  document,
  journeyOptions,
  preview,
  routes,
  templates,
}: AppendSubstituteServicePlanOptions): AppendedSubstituteServicePlan {
  const currentJourneyIds = new Set(document.journeys.map((journey) => journey.id))
  const nextJourneys = [...document.journeys]
  const importedJourneys: JourneyDefinition[] = []
  const journeyChanges: PlannedJourneyChange[] = []
  const warnings: string[] = []
  const journeyOptionById = new Map(journeyOptions.map((journeyOption) => [journeyOption.id, journeyOption]))
  const importedJourneyIdBySourceId = new Map<string, string>()

  function resolveCommittedJourneyId(journeyId: string) {
    if (currentJourneyIds.has(journeyId)) {
      return journeyId
    }

    const existingImportedJourneyId = importedJourneyIdBySourceId.get(journeyId)
    if (existingImportedJourneyId) {
      return existingImportedJourneyId
    }

    const journeyOption = journeyOptionById.get(journeyId)
    if (!journeyOption) {
      return null
    }

    if (journeyOption.source === 'current') {
      return journeyId
    }

    const importedJourney = cloneJourneyDefinition(journeyOption.journey, nextJourneys)
    nextJourneys.push(importedJourney)
    importedJourneys.push(importedJourney)
    journeyChanges.push({
      dutyLabel: null,
      kind: 'reference-import',
      pauseBeforeJourneyAfter: importedJourney.pauseBeforeJourney,
      pauseBeforeJourneyBefore: journeyOption.journey.pauseBeforeJourney,
      resultingJourneyKey: importedJourney.key,
      sourceJourneyKey: journeyOption.journey.key,
    })
    importedJourneyIdBySourceId.set(journeyId, importedJourney.id)

    return importedJourney.id
  }

  function resolveSourceJourney(journeyId: string) {
    const currentJourney = document.journeys.find((journey) => journey.id === journeyId)
    if (currentJourney) {
      return currentJourney
    }

    return journeyOptionById.get(journeyId)?.journey ?? null
  }

  const dutyCommitContexts = templates.map((template, templateIndex) => {
    const dutyPreview = preview.dutyPreviews[templateIndex]
    const dutyLabel = dutyPreview?.dutyLabel ?? template.dutyLabel ?? `Duty ${String.fromCharCode(65 + templateIndex)}`
    const journeyIds = template.journeyIds.filter(Boolean)
    const assignedOrders = dutyPreview?.assignedOrders ?? []
    const sourceJourneys = journeyIds.map((journeyId) => resolveSourceJourney(journeyId))
    const cycleDurationMinutes = sourceJourneys.some((journey) => !journey)
      ? null
      : sourceJourneys.reduce((total, journey) => total + getJourneyDurationInfo(journey!, routes).totalMinutes, 0)
    const firstJourneyPauseMinutes = sourceJourneys[0] ? parseMinuteValue(sourceJourneys[0].pauseBeforeJourney) : 0
    const validAssignments = assignedOrders
      .filter((assignment) => assignment.startTime)
      .map((assignment) => ({
        ...assignment,
        finalStartMinutes: parseClockMinutes(assignment.finalStartTime ?? assignment.startTime!),
        startMinutes: parseClockMinutes(assignment.startTime!),
      }))
      .filter((assignment) => assignment.startMinutes !== null)
      .sort((left, right) => left.startMinutes! - right.startMinutes!)

    const regularLoopGapMinutes = getRegularLoopGapMinutes(validAssignments)
    const cycleAdjustmentMinutes = regularLoopGapMinutes !== null && cycleDurationMinutes !== null
      ? regularLoopGapMinutes - cycleDurationMinutes
      : null
    const canRetimeLoopCycle = cycleAdjustmentMinutes !== null && sourceJourneys.every((journey): journey is JourneyDefinition => Boolean(journey)) && firstJourneyPauseMinutes + cycleAdjustmentMinutes >= 0

    return {
      assignedOrders,
      cycleAdjustmentMinutes,
      dutyLabel,
      firstJourneyPauseMinutes,
      journeyIds,
      regularLoopGapMinutes,
      sourceJourneys,
      validAssignments,
      canRetimeLoopCycle,
    }
  })

  const blockedCurrentJourneyIds = new Set<string>()
  const currentJourneyRetimePlans = new Map<string, {
    desiredPause: string
    dutyLabels: string[]
    sourceJourney: JourneyDefinition
  }>()

  for (const context of dutyCommitContexts) {
    if (
      context.journeyIds.length === 0 ||
      context.regularLoopGapMinutes === null ||
      context.cycleAdjustmentMinutes === null ||
      context.cycleAdjustmentMinutes === 0 ||
      !context.canRetimeLoopCycle
    ) {
      continue
    }

    const firstJourneyId = context.journeyIds[0]
    const firstJourney = context.sourceJourneys[0]
    if (!firstJourneyId || !firstJourney) {
      continue
    }

    const firstJourneyOption = journeyOptionById.get(firstJourneyId)
    if (firstJourneyOption?.source !== 'current') {
      continue
    }

    const desiredPause = formatPauseValue(context.firstJourneyPauseMinutes + context.cycleAdjustmentMinutes)
    const existingPlan = currentJourneyRetimePlans.get(firstJourneyId)

    if (!existingPlan) {
      currentJourneyRetimePlans.set(firstJourneyId, {
        desiredPause,
        dutyLabels: [context.dutyLabel],
        sourceJourney: firstJourney,
      })
      continue
    }

    if (existingPlan.desiredPause !== desiredPause) {
      blockedCurrentJourneyIds.add(firstJourneyId)
      continue
    }

    if (!existingPlan.dutyLabels.includes(context.dutyLabel)) {
      existingPlan.dutyLabels.push(context.dutyLabel)
    }
  }

  for (const blockedCurrentJourneyId of blockedCurrentJourneyIds) {
    currentJourneyRetimePlans.delete(blockedCurrentJourneyId)
  }

  const appliedCurrentJourneyRetimeIds = new Set<string>()

  function applyCurrentJourneyRetime(journeyId: string) {
    const retimePlan = currentJourneyRetimePlans.get(journeyId)
    if (!retimePlan) {
      return true
    }

    if (appliedCurrentJourneyRetimeIds.has(journeyId)) {
      return true
    }

    const currentJourneyIndex = nextJourneys.findIndex((journey) => journey.id === journeyId)
    if (currentJourneyIndex < 0) {
      return false
    }

    const existingJourney = nextJourneys[currentJourneyIndex]!
    const updatedJourney = {
      ...existingJourney,
      pauseBeforeJourney: retimePlan.desiredPause,
    }

    nextJourneys[currentJourneyIndex] = updatedJourney
    appliedCurrentJourneyRetimeIds.add(journeyId)
    journeyChanges.push({
      dutyLabel: retimePlan.dutyLabels.join(', '),
      kind: 'current-retime',
      pauseBeforeJourneyAfter: retimePlan.desiredPause,
      pauseBeforeJourneyBefore: retimePlan.sourceJourney.pauseBeforeJourney,
      resultingJourneyKey: updatedJourney.key,
      sourceJourneyKey: retimePlan.sourceJourney.key,
    })

    return true
  }

  function createLoopCommittedJourneyId(
    journeyId: string,
    journey: JourneyDefinition,
    dutyLabel: string,
    adjustedPauseBeforeJourney?: string,
  ) {
    const journeyOption = journeyOptionById.get(journeyId)

    if (journeyOption?.source === 'current') {
      if (adjustedPauseBeforeJourney !== undefined && adjustedPauseBeforeJourney !== journey.pauseBeforeJourney && !applyCurrentJourneyRetime(journeyId)) {
        return null
      }

      return journeyId
    }

    const importedJourney = cloneJourneyDefinition(journey, nextJourneys)
    if (adjustedPauseBeforeJourney !== undefined) {
      importedJourney.pauseBeforeJourney = adjustedPauseBeforeJourney
    }

    nextJourneys.push(importedJourney)
    importedJourneys.push(importedJourney)
    journeyChanges.push({
      dutyLabel,
      kind: adjustedPauseBeforeJourney !== undefined && importedJourney.pauseBeforeJourney !== journey.pauseBeforeJourney
        ? 'loop-retimed-clone'
        : 'loop-clone',
      pauseBeforeJourneyAfter: importedJourney.pauseBeforeJourney,
      pauseBeforeJourneyBefore: journey.pauseBeforeJourney,
      resultingJourneyKey: importedJourney.key,
      sourceJourneyKey: journey.key,
    })

    return importedJourney.id
  }

  const plannedOrders = dutyCommitContexts.flatMap((context) => {
    const {
      assignedOrders,
      cycleAdjustmentMinutes,
      dutyLabel,
      firstJourneyPauseMinutes,
      journeyIds,
      regularLoopGapMinutes,
      sourceJourneys,
      validAssignments,
      canRetimeLoopCycle,
    } = context

    if (journeyIds.length === 0) {
      warnings.push(`${dutyLabel} has no selected journeys to commit.`)
      return []
    }

    const firstJourneyId = journeyIds[0] ?? null
    const firstJourney = sourceJourneys[0]
    const firstJourneyOption = firstJourneyId ? journeyOptionById.get(firstJourneyId) : null
    const hasBlockedCurrentRetime = firstJourneyId ? blockedCurrentJourneyIds.has(firstJourneyId) : false

    if (
      regularLoopGapMinutes !== null &&
      validAssignments.length > 0 &&
      cycleAdjustmentMinutes !== null &&
      (cycleAdjustmentMinutes === 0 || (canRetimeLoopCycle && !hasBlockedCurrentRetime))
    ) {
      let committedJourneyIds: string[] | null = null
      let loopStartMinutes = validAssignments[0]!.startMinutes!
      let loopStartTime = validAssignments[0]!.startTime!

      if (cycleAdjustmentMinutes !== 0) {
        const adjustedFirstJourneyPause = formatPauseValue(firstJourneyPauseMinutes + cycleAdjustmentMinutes)
        const resolvedJourneyIds = journeyIds.map((journeyId, journeyIndex) => {
          const sourceJourney = sourceJourneys[journeyIndex]
          if (!sourceJourney) {
            return null
          }

          return createLoopCommittedJourneyId(
            journeyId,
            sourceJourney,
            dutyLabel,
            journeyIndex === 0 ? adjustedFirstJourneyPause : undefined,
          )
        })

        if (resolvedJourneyIds.some((journeyId) => journeyId === null)) {
          warnings.push(`${dutyLabel} references a missing journey and was skipped.`)
          return []
        }

        committedJourneyIds = resolvedJourneyIds as string[]
        loopStartMinutes -= cycleAdjustmentMinutes
        loopStartTime = formatClockMinutes(loopStartMinutes)
      } else {
        const resolvedJourneyIds = journeyIds.map((journeyId) => resolveCommittedJourneyId(journeyId))
        if (resolvedJourneyIds.some((journeyId) => journeyId === null)) {
          warnings.push(`${dutyLabel} references a missing journey and was skipped.`)
          return []
        }

        committedJourneyIds = resolvedJourneyIds as string[]
      }

      if (!committedJourneyIds) {
        warnings.push(`${dutyLabel} references a missing journey and was skipped.`)
        return []
      }

      const firstAssignment = validAssignments[0]
      const lastRecurringStartMinutes = validAssignments.reduce((latestStartMinutes, assignment) => {
        const finalStartMinutes = assignment.finalStartMinutes ?? assignment.startMinutes
        return finalStartMinutes !== null && finalStartMinutes > latestStartMinutes
          ? finalStartMinutes
          : latestStartMinutes
      }, firstAssignment!.startMinutes!)

      return [{
        baseOrderNumber: firstAssignment!.orderNumber,
        dutyLabel,
        journeyIds: committedJourneyIds,
        loopUntil: lastRecurringStartMinutes > firstAssignment!.startMinutes!
          ? formatClockMinutes(lastRecurringStartMinutes + firstJourneyPauseMinutes + 1)
          : '',
        startMinutes: loopStartMinutes,
        startTime: loopStartTime,
      }]
    }

    if (regularLoopGapMinutes !== null && cycleAdjustmentMinutes !== null && cycleAdjustmentMinutes !== 0 && hasBlockedCurrentRetime && firstJourneyOption?.source === 'current' && firstJourney) {
      warnings.push(`${dutyLabel} would need a different pause-before-journey value on ${firstJourney.key} than another duty using the same current journey, so explicit starts were generated instead.`)
    } else if (regularLoopGapMinutes !== null && cycleAdjustmentMinutes !== null && cycleAdjustmentMinutes !== 0 && !canRetimeLoopCycle) {
      warnings.push(`${dutyLabel} could not retime the first substitute leg enough to match the required ${regularLoopGapMinutes}-minute loop gap, so explicit starts were generated instead.`)
    }

    return assignedOrders.flatMap((assignment) => {
      if (!assignment.startTime) {
        warnings.push(`${dutyLabel} base order ${assignment.orderNumber} has no suggested start and was skipped.`)
        return []
      }

      const committedJourneyIds = journeyIds.map((journeyId) => resolveCommittedJourneyId(journeyId))
      if (committedJourneyIds.some((journeyId) => journeyId === null)) {
        warnings.push(`${dutyLabel} base order ${assignment.orderNumber} references a missing journey and was skipped.`)
        return []
      }

      return [{
        baseOrderNumber: assignment.orderNumber,
        dutyLabel,
        journeyIds: committedJourneyIds as string[],
        loopUntil: '',
        startMinutes: parseClockMinutes(assignment.startTime),
        startTime: assignment.startTime,
      }]
    })
  }).sort((left, right) => {
    if (left.startMinutes === null && right.startMinutes === null) {
      return left.baseOrderNumber - right.baseOrderNumber
    }

    if (left.startMinutes === null) {
      return 1
    }

    if (right.startMinutes === null) {
      return -1
    }

    return left.startMinutes - right.startMinutes || left.baseOrderNumber - right.baseOrderNumber || left.dutyLabel.localeCompare(right.dutyLabel)
  })

  const nextOrderNumber = getNextShiftOrderNumber(document)
  const createdOrders = plannedOrders.map((plannedOrder, index) => createShiftOrder(
    nextOrderNumber + index,
    [
      createTimeNode(plannedOrder.startTime),
      {
        ...createJourneyNode(plannedOrder.journeyIds),
        loopUntil: plannedOrder.loopUntil,
      },
    ],
  ))

  return {
    createdOrders,
    document: {
      journeys: nextJourneys,
      shiftOrders: [...document.shiftOrders, ...createdOrders],
    },
    firstCreatedOrderId: createdOrders[0]?.id ?? null,
    importedJourneys,
    journeyChanges,
    warnings,
  }
}