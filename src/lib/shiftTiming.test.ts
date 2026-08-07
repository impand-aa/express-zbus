import { describe, expect, it } from 'vitest'

import { createJourney, createJourneyNode, createPanelRow, createShiftOrder, createStopRow, createTimeNode } from './document'
import { buildShiftOrderTimeline, getJourneyDurationInfo, getShiftOrderTimingPreviews } from './shiftTiming'

describe('shift timing helpers', () => {
  it('computes a journey duration from both pauses plus the last stop offset', () => {
    const journey = createJourney({
      pauseBeforeJourney: '5',
      pauseAfterJourney: '2',
      orders: [
        createStopRow('Alpha', 'A', '0'),
        createStopRow('Beta', 'B', '3'),
        createStopRow('Gamma', 'C', '6'),
      ],
    })

    expect(getJourneyDurationInfo(journey, [])).toEqual({
      isDisplayable: true,
      isResolvable: true,
      pauseMinutes: 7,
      totalMinutes: 13,
      travelMinutes: 6,
    })
  })

  it('does not display empty zero-minute journeys', () => {
    const journey = createJourney({
      pauseBeforeDeparture: '',
      orders: [
        createStopRow('Alpha', 'A', '0'),
      ],
    })

    expect(getJourneyDurationInfo(journey, [])).toEqual({
      isDisplayable: false,
      isResolvable: true,
      pauseMinutes: 0,
      totalMinutes: 0,
      travelMinutes: 0,
    })
  })

  it('supports fractional stop offsets and formats stop times with seconds when needed', () => {
    const journey = createJourney({
      key: 'journey_fractional',
      pauseBeforeJourney: '0.5',
      pauseAfterJourney: '0.25',
      orders: [
        createStopRow('Alpha', 'A', '0'),
        createStopRow('Beta', 'B', '1.25'),
      ],
    })
    const order = createShiftOrder(1, [
      createTimeNode('04:30'),
      createJourneyNode([journey.id]),
    ])

    const timeline = buildShiftOrderTimeline(order, [journey], [])

    expect(timeline).toMatchObject({
      endTime: '04:32',
      totalDurationMinutes: 2,
    })
    expect(timeline.segments[0]).toMatchObject({
      startTime: '04:30',
      departureTime: '04:30:30',
      endTime: '04:31:45',
      durationMinutes: 2,
      stops: [
        { stopName: 'Alpha', time: '04:30:30' },
        { stopName: 'Beta', time: '04:31:45' },
      ],
    })
  })

  it('resolves a later time node to the next day instead of jumping backward', () => {
    const journey = createJourney({
      key: 'journey_night',
      orders: [
        createStopRow('Depot', 'A', '0'),
        createStopRow('Center', 'B', '1'),
      ],
    })
    const order = createShiftOrder(9, [
      createTimeNode('23:58'),
      createJourneyNode([journey.id]),
      createTimeNode('00:00'),
      createJourneyNode([journey.id]),
    ])

    const previews = getShiftOrderTimingPreviews(order, [journey], [])
    const timeline = buildShiftOrderTimeline(order, [journey], [])

    expect(previews[3]).toMatchObject({
      journeyDurations: [
        { isDisplayable: true, isResolvable: true, totalMinutes: 1 },
      ],
      loopSummary: {
        estimatedEndTime: '00:01',
        totalDurationMinutes: 1,
      },
    })
    expect(timeline.segments).toMatchObject([
      {
        startTime: '23:58',
        departureTime: '23:58',
        endTime: '23:59',
      },
      {
        startTime: '00:00',
        departureTime: '00:00',
        endTime: '00:01',
      },
    ])
    expect(timeline.totalDurationMinutes).toBe(2)
  })

  it('treats loopUntil after midnight as the next occurrence on the timeline', () => {
    const journey = createJourney({
      key: 'journey_loop_night',
      orders: [
        createStopRow('Depot', 'A', '0'),
        createStopRow('Center', 'B', '1'),
      ],
    })
    const order = createShiftOrder(10, [
      createTimeNode('23:59'),
      {
        ...createJourneyNode([journey.id]),
        loopUntil: '00:01',
      },
    ])

    const previews = getShiftOrderTimingPreviews(order, [journey], [])
    const timeline = buildShiftOrderTimeline(order, [journey], [])

    expect(previews[1]).toMatchObject({
      journeyDurations: [
        { isDisplayable: true, isResolvable: true, totalMinutes: 1 },
      ],
      loopSummary: {
        estimatedEndTime: '00:01',
        totalDurationMinutes: 2,
      },
    })
    expect(timeline.segments).toHaveLength(2)
    expect(timeline.segments[0]).toMatchObject({
      startTime: '23:59',
      endTime: '00:00',
    })
    expect(timeline.segments[1]).toMatchObject({
      startTime: '00:00',
      endTime: '00:01',
    })
  })

  it('keeps long same-day time nodes on the current day instead of jumping backward', () => {
    const journey = createJourney({
      key: 'journey_same_day_time_node',
      orders: [
        createStopRow('Depot', 'A', '0'),
        createStopRow('Center', 'B', '1'),
      ],
    })
    const order = createShiftOrder(11, [
      createTimeNode('04:30'),
      createJourneyNode([journey.id]),
      createTimeNode('22:00'),
      createJourneyNode([journey.id]),
    ])

    const timeline = buildShiftOrderTimeline(order, [journey], [])

    expect(timeline.segments).toMatchObject([
      {
        startTime: '04:30',
        endTime: '04:31',
      },
      {
        startTime: '22:00',
        endTime: '22:01',
      },
    ])
    expect(timeline.totalDurationMinutes).toBe(2)
  })

  it('shortens pauses with time nodes by default, with an explicit opt-out', () => {
    const journey = createJourney({
      key: 'journey_shorten_pause',
      pauseAfterJourney: '11',
      orders: [
        createStopRow('Depot', 'A', '0'),
        createStopRow('Center', 'B', '1'),
      ],
    })
    const defaultOrder = createShiftOrder(14, [
      createTimeNode('11:59'),
      createJourneyNode([journey.id]),
      createTimeNode('12:05', false),
      createJourneyNode([journey.id]),
    ])
    const adjustedOrder = createShiftOrder(15, [
      createTimeNode('11:59'),
      createJourneyNode([journey.id]),
      createTimeNode('12:05'),
      createJourneyNode([journey.id]),
    ])

    const defaultTimeline = buildShiftOrderTimeline(defaultOrder, [journey], [])
    const adjustedTimeline = buildShiftOrderTimeline(adjustedOrder, [journey], [])
    const adjustedPreviews = getShiftOrderTimingPreviews(adjustedOrder, [journey], [])

    expect(defaultTimeline.segments).toMatchObject([
      { startTime: '11:59', endTime: '12:00' },
      { startTime: '12:05', endTime: '12:06' },
    ])
    expect(adjustedTimeline.segments).toMatchObject([
      { startTime: '11:59', endTime: '12:00' },
      { startTime: '12:05', endTime: '12:06' },
    ])
    expect((defaultTimeline.endMinutes ?? 0) - (defaultTimeline.startMinutes ?? 0)).toBe(1458)
    expect((adjustedTimeline.endMinutes ?? 0) - (adjustedTimeline.startMinutes ?? 0)).toBe(18)
    expect(adjustedPreviews[3]).toMatchObject({
      journeyDurations: [
        { isDisplayable: true, isResolvable: true, totalMinutes: 12 },
      ],
      loopSummary: {
        estimatedEndTime: '12:17',
        totalDurationMinutes: 12,
      },
    })
  })

  it('does not add a full extra day when loopUntil is only slightly behind the current clock', () => {
    const journey = createJourney({
      key: 'journey_nearest_loop_until',
      orders: [
        createStopRow('Depot', 'A', '0'),
        createStopRow('Center', 'B', '1'),
      ],
    })
    const order = createShiftOrder(12, [
      createTimeNode('00:02'),
      {
        ...createJourneyNode([journey.id]),
        loopUntil: '00:00',
      },
    ])

    const previews = getShiftOrderTimingPreviews(order, [journey], [])
    const timeline = buildShiftOrderTimeline(order, [journey], [])

    expect(previews[1]).toMatchObject({
      journeyDurations: [
        { isDisplayable: true, isResolvable: true, totalMinutes: 1 },
      ],
      loopSummary: {
        estimatedEndTime: '00:03',
        totalDurationMinutes: 1,
      },
    })
    expect(timeline.segments).toHaveLength(1)
    expect(timeline.segments[0]).toMatchObject({
      startTime: '00:02',
      endTime: '00:03',
    })
  })

  it('keeps long same-day loopUntil bounds on the same day', () => {
    const journey = createJourney({
      key: 'journey_long_same_day_loop',
      orders: [
        createStopRow('Depot', 'A', '0'),
        createStopRow('Center', 'B', '30'),
      ],
    })
    const order = createShiftOrder(13, [
      createTimeNode('04:30'),
      {
        ...createJourneyNode([journey.id]),
        loopUntil: '22:00',
      },
    ])

    const previews = getShiftOrderTimingPreviews(order, [journey], [])
    const timeline = buildShiftOrderTimeline(order, [journey], [])

    expect(previews[1]).toMatchObject({
      journeyDurations: [
        { isDisplayable: true, isResolvable: true, totalMinutes: 30 },
      ],
      loopSummary: {
        estimatedEndTime: '22:00',
        totalDurationMinutes: 1050,
      },
    })
    expect(timeline.segments).toHaveLength(35)
    expect(timeline.segments[0]).toMatchObject({
      startTime: '04:30',
      endTime: '05:00',
    })
    expect(timeline.segments.at(-1)).toMatchObject({
      startTime: '21:30',
      endTime: '22:00',
    })
  })

  it('calculates loop totals and estimated end time from the active order clock', () => {
    const journeyA = createJourney({
      key: 'journey_a',
      pauseBeforeDeparture: '5',
      orders: [
        createStopRow('Alpha', 'A', '0'),
        createStopRow('Beta', 'B', '6'),
      ],
    })
    const journeyB = createJourney({
      key: 'journey_b',
      pauseBeforeDeparture: '2',
      orders: [
        createStopRow('Gamma', 'A', '0'),
        createStopRow('Delta', 'B', '3'),
      ],
    })
    const order = createShiftOrder(1, [
      createTimeNode('04:30'),
      createJourneyNode([journeyA.id, journeyB.id]),
      {
        ...createJourneyNode([journeyA.id, journeyB.id]),
        loopUntil: '05:10',
      },
    ])

    const previews = getShiftOrderTimingPreviews(order, [journeyA, journeyB], [])

    expect(previews[2]).toMatchObject({
      journeyDurations: [
        { isDisplayable: true, isResolvable: true, totalMinutes: 11 },
        { isDisplayable: true, isResolvable: true, totalMinutes: 5 },
      ],
      loopSummary: {
        estimatedEndTime: '05:18',
        totalDurationMinutes: 32,
      },
    })
  })

  it('calculates non-loop node totals and scheduled end time from the active order clock', () => {
    const journeyA = createJourney({
      key: 'journey_a',
      pauseBeforeDeparture: '5',
      orders: [
        createStopRow('Alpha', 'A', '0'),
        createStopRow('Beta', 'B', '6'),
      ],
    })
    const journeyB = createJourney({
      key: 'journey_b',
      pauseBeforeDeparture: '2',
      orders: [
        createStopRow('Gamma', 'A', '0'),
        createStopRow('Delta', 'B', '3'),
      ],
    })
    const order = createShiftOrder(1, [
      createTimeNode('04:30'),
      createJourneyNode([journeyA.id, journeyB.id]),
    ])

    const previews = getShiftOrderTimingPreviews(order, [journeyA, journeyB], [])

    expect(previews[1]).toMatchObject({
      journeyDurations: [
        { isDisplayable: true, isResolvable: true, totalMinutes: 11 },
        { isDisplayable: true, isResolvable: true, totalMinutes: 5 },
      ],
      loopSummary: {
        estimatedEndTime: '04:46',
        totalDurationMinutes: 16,
      },
    })
  })

  it('keeps pause after journey between consecutive segments and in the order end time', () => {
    const journeyA = createJourney({
      key: 'journey_a',
      pauseBeforeJourney: '2',
      pauseAfterJourney: '3',
      orders: [
        createStopRow('Alpha', 'A', '0'),
        createStopRow('Gamma', 'B', '6'),
      ],
    })
    const journeyB = createJourney({
      key: 'journey_b',
      orders: [
        createStopRow('Gamma', 'C', '0'),
        createStopRow('Depot', 'D', '2'),
      ],
    })
    const order = createShiftOrder(4, [
      createTimeNode('04:30'),
      createJourneyNode([journeyA.id, journeyB.id]),
    ])

    const timeline = buildShiftOrderTimeline(order, [journeyA, journeyB], [])

    expect(timeline).toMatchObject({
      endTime: '04:43',
      totalDurationMinutes: 13,
    })
    expect(timeline.segments[0]).toMatchObject({
      startTime: '04:30',
      departureTime: '04:32',
      endTime: '04:38',
      durationMinutes: 11,
      pauseAfterMinutes: 3,
      pauseBeforeMinutes: 2,
    })
    expect(timeline.segments[1]).toMatchObject({
      startTime: '04:41',
      departureTime: '04:41',
      endTime: '04:43',
    })
  })

  it('expands a looping shift order into scheduled journey segments and stop times', () => {
    const journeyA = createJourney({
      key: 'journey_a',
      lineDisplay: { kind: 'number', value: '12' },
      from: 'Alpha',
      to: 'Gamma',
      pauseBeforeDeparture: '4',
      orders: [
        createPanelRow('910'),
        createStopRow('Alpha', 'A', '0'),
        createStopRow('Gamma', 'B', '6'),
      ],
    })
    const journeyB = createJourney({
      key: 'journey_b',
      lineDisplay: { kind: 'number', value: '12' },
      from: 'Gamma',
      to: 'Depot',
      pauseBeforeDeparture: '1',
      orders: [
        createStopRow('Gamma', 'C', '0'),
        createStopRow('Depot', 'D', '2'),
      ],
    })
    const order = createShiftOrder(7, [
      createTimeNode('04:30'),
      {
        ...createJourneyNode([journeyA.id, journeyB.id]),
        loopUntil: '05:00',
      },
    ])

    const timeline = buildShiftOrderTimeline(order, [journeyA, journeyB], [])

    expect(timeline).toMatchObject({
      orderNumber: 7,
      startTime: '04:30',
      endTime: '05:09',
      totalDurationMinutes: 39,
    })
    expect(timeline.segments).toHaveLength(6)
    expect(timeline.segments[0]).toMatchObject({
      cycleIndex: 0,
      journeyKey: 'journey_a',
      startTime: '04:30',
      departureTime: '04:34',
      endTime: '04:40',
      durationMinutes: 10,
      panelChanges: [
        { label: 'P 910', panelIdValue: '910', time: '04:34' },
      ],
      stops: [
        { stopName: 'Alpha', time: '04:34' },
        { stopName: 'Gamma', time: '04:40' },
      ],
    })
    expect(timeline.segments[5]).toMatchObject({
      cycleIndex: 2,
      journeyKey: 'journey_b',
      startTime: '05:06',
      departureTime: '05:07',
      endTime: '05:09',
      durationMinutes: 3,
    })
  })
})