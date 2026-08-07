import { buildOperationsOverviewData } from './operationsOverview'
import type { ImportedRouteDefinition, ShiftDocument } from '../types'

export interface IntegrityIntervalRangeConfig {
  enabled: boolean
  maxMinutes: string
  minMinutes: string
  sameJourneyOnly: boolean
}

export interface IntegrityConfig {
  intervalRanges: IntegrityIntervalRangeConfig[]
}

export interface IntegrityWarning {
  description: string
  gapMinutes: number
  id: string
  kind: 'interval-range'
  title: string
}

interface ParsedIntegrityIntervalRangeConfig {
  maxMinutes: number | null
  minMinutes: number | null
  sameJourneyOnly: boolean
}

function parseOptionalMinutes(value: string) {
  const normalizedValue = value.trim()
  if (!normalizedValue) {
    return null
  }

  const numericValue = Number(normalizedValue)
  return Number.isFinite(numericValue) ? numericValue : null
}

function getConfiguredRangeLabel(minMinutes: number | null, maxMinutes: number | null) {
  if (minMinutes !== null && maxMinutes !== null) {
    return minMinutes === maxMinutes ? `${minMinutes} min` : `${minMinutes}-${maxMinutes} min`
  }

  if (minMinutes !== null) {
    return `${minMinutes}+ min`
  }

  if (maxMinutes !== null) {
    return `up to ${maxMinutes} min`
  }

  return 'configured interval range'
}

function getConfiguredRangesLabel(ranges: ParsedIntegrityIntervalRangeConfig[]) {
  if (ranges.length === 0) {
    return 'configured interval range'
  }

  return ranges.map((range) => {
    const label = getConfiguredRangeLabel(range.minMinutes, range.maxMinutes)
    return range.sameJourneyOnly ? `${label} (same journey only)` : label
  }).join(' or ')
}

function getStopPlatformLabel(stopName: string, platform: string) {
  if (!platform) {
    return stopName
  }

  return `${stopName} (Platform ${platform})`
}

function isGapWithinRange(gapMinutes: number, minMinutes: number | null, maxMinutes: number | null) {
  if (minMinutes !== null && gapMinutes < minMinutes) {
    return false
  }

  if (maxMinutes !== null && gapMinutes > maxMinutes) {
    return false
  }

  return true
}

export function createDefaultIntegrityConfig(): IntegrityConfig {
  return {
    intervalRanges: [
      {
        enabled: false,
        maxMinutes: '',
        minMinutes: '',
        sameJourneyOnly: false,
      },
    ],
  }
}

export function getIntegrityConfigIssue(config: IntegrityConfig) {
  for (let rangeIndex = 0; rangeIndex < config.intervalRanges.length; rangeIndex += 1) {
    const range = config.intervalRanges[rangeIndex]
    if (!range?.enabled) {
      continue
    }

    const parsedMinMinutes = parseOptionalMinutes(range.minMinutes)
    const parsedMaxMinutes = parseOptionalMinutes(range.maxMinutes)
    const rangeLabel = `Interval ${rangeIndex + 1}`

    if (range.minMinutes.trim() && parsedMinMinutes === null) {
      return `${rangeLabel} minimum must be a numeric minute value.`
    }

    if (range.maxMinutes.trim() && parsedMaxMinutes === null) {
      return `${rangeLabel} maximum must be a numeric minute value.`
    }

    if (parsedMinMinutes === null && parsedMaxMinutes === null) {
      return `${rangeLabel} needs a minimum or maximum minute value.`
    }

    if (parsedMinMinutes !== null && parsedMaxMinutes !== null && parsedMaxMinutes < parsedMinMinutes) {
      return `${rangeLabel} maximum must be greater than or equal to minimum interval.`
    }
  }

  return ''
}

export function buildIntegrityWarnings(
  document: ShiftDocument,
  routes: ImportedRouteDefinition[],
  config: IntegrityConfig,
): IntegrityWarning[] {
  if (getIntegrityConfigIssue(config)) {
    return []
  }

  const configuredRanges: ParsedIntegrityIntervalRangeConfig[] = config.intervalRanges
    .filter((range) => range.enabled)
    .map((range) => ({
      maxMinutes: parseOptionalMinutes(range.maxMinutes),
      minMinutes: parseOptionalMinutes(range.minMinutes),
      sameJourneyOnly: range.sameJourneyOnly,
    }))
    .filter((range) => range.minMinutes !== null || range.maxMinutes !== null)

  if (configuredRanges.length === 0) {
    return []
  }

  const overviewData = buildOperationsOverviewData(document, routes)
  const departuresByIntegrityKey = new Map<string, typeof overviewData.departures>()

  for (const departure of overviewData.departures) {
    const integrityKey = [departure.stopName, departure.platform, departure.lineDisplayText, departure.direction].join('::')
    const currentGroup = departuresByIntegrityKey.get(integrityKey)

    if (currentGroup) {
      currentGroup.push(departure)
      continue
    }

    departuresByIntegrityKey.set(integrityKey, [departure])
  }

  const warnings: IntegrityWarning[] = []

  for (const departures of departuresByIntegrityKey.values()) {
    departures.sort((left, right) => left.departureMinutes - right.departureMinutes || left.orderNumber - right.orderNumber)

    for (let departureIndex = 1; departureIndex < departures.length; departureIndex += 1) {
      const previousDeparture = departures[departureIndex - 1]
      const currentDeparture = departures[departureIndex]
      if (!previousDeparture || !currentDeparture || previousDeparture.orderNumber === currentDeparture.orderNumber) {
        continue
      }

      const applicableRanges = configuredRanges.filter((range) => !range.sameJourneyOnly || previousDeparture.journeyKey === currentDeparture.journeyKey)
      if (applicableRanges.length === 0) {
        continue
      }

      const gapMinutes = currentDeparture.departureMinutes - previousDeparture.departureMinutes
      const matchesConfiguredRange = applicableRanges.some((range) => isGapWithinRange(gapMinutes, range.minMinutes, range.maxMinutes))
      if (matchesConfiguredRange) {
        continue
      }

      warnings.push({
        description: `${gapMinutes} min between order ${previousDeparture.orderNumber} at ${previousDeparture.departureTime} and order ${currentDeparture.orderNumber} at ${currentDeparture.departureTime}; expected ${getConfiguredRangesLabel(applicableRanges)}.${currentDeparture.platform ? ` Platform ${currentDeparture.platform}.` : ''}`,
        gapMinutes,
        id: `interval-range-${previousDeparture.id}-${currentDeparture.id}`,
        kind: 'interval-range',
        title: `${getStopPlatformLabel(currentDeparture.stopName, currentDeparture.platform)} | ${currentDeparture.lineDisplayText} -> ${currentDeparture.direction}`,
      })
    }
  }

  return warnings.sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }) || left.gapMinutes - right.gapMinutes)
}