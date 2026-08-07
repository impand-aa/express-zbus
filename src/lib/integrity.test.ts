import { describe, expect, it } from 'vitest'

import { createJourney, createJourneyNode, createShiftOrder, createStopRow, createTimeNode } from './document'
import { buildIntegrityWarnings, getIntegrityConfigIssue } from './integrity'

describe('integrity checks', () => {
  it('warns when a configured interval range is violated between consecutive duties', () => {
    const journey = createJourney({
      key: 'to_center',
      lineDisplay: { kind: 'number', value: '34' },
      orders: [
        createStopRow('Central stop', 'A', '0'),
      ],
    })
    const document = {
      journeys: [journey],
      shiftOrders: [
        createShiftOrder(1, [createTimeNode('04:30'), createJourneyNode([journey.id])]),
        createShiftOrder(2, [createTimeNode('04:34'), createJourneyNode([journey.id])]),
      ],
    }

    const warnings = buildIntegrityWarnings(document, [], {
      intervalRanges: [
        {
          enabled: true,
          maxMinutes: '10',
          minMinutes: '5',
          sameJourneyOnly: false,
        },
      ],
    })

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({
      gapMinutes: 4,
      title: 'Central stop (Platform A) | 34 -> Central stop',
    })
    expect(warnings[0]?.description).toContain('expected 5-10 min')
  })

  it('does not compare departures across different platforms', () => {
    const platformAJourney = createJourney({
      key: 'to_center_a',
      lineDisplay: { kind: 'number', value: '34' },
      orders: [
        createStopRow('Central stop', 'A', '0'),
      ],
    })
    const platformBJourney = createJourney({
      key: 'to_center_b',
      lineDisplay: { kind: 'number', value: '34' },
      orders: [
        createStopRow('Central stop', 'B', '0'),
      ],
    })
    const document = {
      journeys: [platformAJourney, platformBJourney],
      shiftOrders: [
        createShiftOrder(1, [createTimeNode('04:30'), createJourneyNode([platformAJourney.id])]),
        createShiftOrder(2, [createTimeNode('04:34'), createJourneyNode([platformBJourney.id])]),
      ],
    }

    const warnings = buildIntegrityWarnings(document, [], {
      intervalRanges: [
        {
          enabled: true,
          maxMinutes: '10',
          minMinutes: '5',
          sameJourneyOnly: false,
        },
      ],
    })

    expect(warnings).toHaveLength(0)
  })

  it('accepts a gap that matches any configured interval', () => {
    const journey = createJourney({
      key: 'to_center',
      lineDisplay: { kind: 'number', value: '34' },
      orders: [
        createStopRow('Central stop', 'A', '0'),
      ],
    })
    const document = {
      journeys: [journey],
      shiftOrders: [
        createShiftOrder(1, [createTimeNode('04:30'), createJourneyNode([journey.id])]),
        createShiftOrder(2, [createTimeNode('04:40'), createJourneyNode([journey.id])]),
        createShiftOrder(3, [createTimeNode('04:46'), createJourneyNode([journey.id])]),
      ],
    }

    const warnings = buildIntegrityWarnings(document, [], {
      intervalRanges: [
        {
          enabled: true,
          maxMinutes: '5',
          minMinutes: '5',
          sameJourneyOnly: false,
        },
        {
          enabled: true,
          maxMinutes: '10',
          minMinutes: '10',
          sameJourneyOnly: false,
        },
      ],
    })

    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.gapMinutes).toBe(6)
    expect(warnings[0]?.description).toContain('expected 5 min or 10 min')
  })

  it('ignores different-journey pairs when an interval is marked same-journey only', () => {
    const journeyA = createJourney({
      key: 'to_center_a',
      lineDisplay: { kind: 'number', value: '34' },
      orders: [
        createStopRow('Central stop', 'A', '0'),
      ],
    })
    const journeyB = createJourney({
      key: 'to_center_b',
      lineDisplay: { kind: 'number', value: '34' },
      orders: [
        createStopRow('Central stop', 'A', '0'),
      ],
    })
    const document = {
      journeys: [journeyA, journeyB],
      shiftOrders: [
        createShiftOrder(1, [createTimeNode('04:30'), createJourneyNode([journeyA.id])]),
        createShiftOrder(2, [createTimeNode('04:36'), createJourneyNode([journeyB.id])]),
      ],
    }

    const warnings = buildIntegrityWarnings(document, [], {
      intervalRanges: [
        {
          enabled: true,
          maxMinutes: '5',
          minMinutes: '5',
          sameJourneyOnly: true,
        },
      ],
    })

    expect(warnings).toHaveLength(0)
  })

  it('uses same-journey-only intervals when the pair shares a journey', () => {
    const journey = createJourney({
      key: 'to_center',
      lineDisplay: { kind: 'number', value: '34' },
      orders: [
        createStopRow('Central stop', 'A', '0'),
      ],
    })
    const document = {
      journeys: [journey],
      shiftOrders: [
        createShiftOrder(1, [createTimeNode('04:30'), createJourneyNode([journey.id])]),
        createShiftOrder(2, [createTimeNode('04:36'), createJourneyNode([journey.id])]),
      ],
    }

    const warnings = buildIntegrityWarnings(document, [], {
      intervalRanges: [
        {
          enabled: true,
          maxMinutes: '5',
          minMinutes: '5',
          sameJourneyOnly: true,
        },
      ],
    })

    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.description).toContain('5 min (same journey only)')
  })

  it('reports invalid interval configuration when max is below min', () => {
    expect(getIntegrityConfigIssue({
      intervalRanges: [
        {
          enabled: true,
          maxMinutes: '5',
          minMinutes: '10',
          sameJourneyOnly: false,
        },
      ],
    })).toBe('Interval 1 maximum must be greater than or equal to minimum interval.')
  })
})