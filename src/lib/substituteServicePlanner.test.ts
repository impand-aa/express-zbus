import { describe, expect, it } from 'vitest'

import { createJourney, createShiftOrder, createStopRow, createTimeNode } from './document'
import { appendSubstituteServicePlan, buildSubstituteServicePlannerPreview } from './substituteServicePlanner'

describe('substitute service planner commit', () => {
  it('appends committed duties as new orders using current journeys', () => {
    const outboundJourney = createJourney({
      key: 'variant_0_to_park',
      pauseBeforeDeparture: '4',
      orders: [
        createStopRow('Priekopnicka', 'D', '0'),
        createStopRow('Galeria', 'B', '1'),
        createStopRow('Mestsky park', 'A', '3'),
      ],
    })
    const inboundJourney = createJourney({
      key: 'variant_0_to_priekopnicka',
      orders: [
        createStopRow('Mestsky park', 'A', '0'),
        createStopRow('Galeria', 'A', '2'),
        createStopRow('Priekopnicka', 'C', '3'),
      ],
    })
    const baseOrders = [
      createShiftOrder(7, [createTimeNode('04:30')]),
      createShiftOrder(8, [createTimeNode('04:35')]),
    ]
    const document = {
      journeys: [outboundJourney, inboundJourney],
      shiftOrders: baseOrders,
    }
    const templates = [{ journeyIds: [outboundJourney.id, inboundJourney.id] }]
    const preview = buildSubstituteServicePlannerPreview({
      journeys: document.journeys,
      maxDesiredBreakMinutes: 8,
      minBreakMinutes: 3,
      routes: [],
      shiftOrders: document.shiftOrders,
      templates,
    })

    const appendedPlan = appendSubstituteServicePlan({
      document,
      journeyOptions: document.journeys.map((journey) => ({
        id: journey.id,
        journey,
        source: 'current' as const,
      })),
      preview,
      routes: [],
      templates,
    })

    expect(appendedPlan.importedJourneys).toHaveLength(0)
    expect(appendedPlan.journeyChanges).toEqual([])
    expect(appendedPlan.createdOrders).toHaveLength(2)
    expect(appendedPlan.document.shiftOrders).toHaveLength(4)
    expect(appendedPlan.createdOrders.map((order) => order.orderNumber)).toEqual([9, 10])
    expect(appendedPlan.createdOrders[0]?.nodes).toMatchObject([
      { kind: 'time', time: '04:30' },
      { kind: 'journeys', journeyIds: [outboundJourney.id, inboundJourney.id], loopUntil: '' },
    ])
    expect(appendedPlan.createdOrders[1]?.nodes).toMatchObject([
      { kind: 'time', time: '04:35' },
      { kind: 'journeys', journeyIds: [outboundJourney.id, inboundJourney.id], loopUntil: '' },
    ])
  })

  it('imports selected reference journeys before appending committed duties', () => {
    const existingJourney = createJourney({
      key: 'variant_1_to_priekopnicka',
      orders: [createStopRow('Existing', 'A', '0')],
    })
    const referenceOutboundJourney = createJourney({
      key: 'variant_1_to_priekopnicka',
      pauseBeforeDeparture: '3',
      orders: [
        createStopRow('Fabriky', 'A', '0'),
        createStopRow('Priekopnicka', 'B', '3'),
      ],
    })
    const referenceInboundJourney = createJourney({
      key: 'variant_1_to_fabriky',
      pauseBeforeDeparture: '1',
      orders: [
        createStopRow('Priekopnicka', 'A', '0'),
        createStopRow('Fabriky', 'B', '3'),
      ],
    })
    const referenceBaseOrders = [
      createShiftOrder(1, [createTimeNode('04:36')]),
      createShiftOrder(2, [createTimeNode('04:41')]),
    ]
    const document = {
      journeys: [existingJourney],
      shiftOrders: [createShiftOrder(5, [createTimeNode('04:20')])],
    }
    const templates = [{ journeyIds: [referenceOutboundJourney.id, referenceInboundJourney.id] }]
    const preview = buildSubstituteServicePlannerPreview({
      baseJourneys: [referenceOutboundJourney, referenceInboundJourney],
      journeys: [referenceOutboundJourney, referenceInboundJourney],
      maxDesiredBreakMinutes: 8,
      minBreakMinutes: 3,
      routes: [],
      shiftOrders: referenceBaseOrders,
      templates,
    })

    const appendedPlan = appendSubstituteServicePlan({
      document,
      journeyOptions: [referenceOutboundJourney, referenceInboundJourney].map((journey) => ({
        id: journey.id,
        journey,
        source: 'reference' as const,
      })),
      preview,
      routes: [],
      templates,
    })

    expect(appendedPlan.importedJourneys).toHaveLength(2)
    expect(appendedPlan.journeyChanges).toMatchObject([
      {
        dutyLabel: null,
        kind: 'reference-import',
        pauseBeforeJourneyAfter: '3',
        pauseBeforeJourneyBefore: '3',
        resultingJourneyKey: 'variant_1_to_priekopnicka_2',
        sourceJourneyKey: 'variant_1_to_priekopnicka',
      },
      {
        dutyLabel: null,
        kind: 'reference-import',
        pauseBeforeJourneyAfter: '1',
        pauseBeforeJourneyBefore: '1',
        resultingJourneyKey: 'variant_1_to_fabriky',
        sourceJourneyKey: 'variant_1_to_fabriky',
      },
    ])
    expect(appendedPlan.importedJourneys.map((journey) => journey.key)).toEqual([
      'variant_1_to_priekopnicka_2',
      'variant_1_to_fabriky',
    ])
    expect(appendedPlan.createdOrders).toHaveLength(2)
    expect(appendedPlan.createdOrders.map((order) => order.orderNumber)).toEqual([6, 7])

    const importedJourneyIds = appendedPlan.importedJourneys.map((journey) => journey.id)
    expect(appendedPlan.createdOrders[0]?.nodes).toMatchObject([
      { kind: 'time', time: '04:36' },
      { kind: 'journeys', journeyIds: importedJourneyIds, loopUntil: '' },
    ])
    expect(appendedPlan.document.journeys).toHaveLength(3)
  })

  it('commits one looping order per duty when assigned starts match the committed cycle', () => {
    const baseLoopJourney = createJourney({
      key: 'base_loop',
      pauseBeforeDeparture: '4',
      orders: [
        createStopRow('Anchor', 'A', '0'),
        createStopRow('Terminal', 'B', '16'),
      ],
    })
    const substituteOut = createJourney({
      key: 'sub_out',
      pauseBeforeDeparture: '4',
      orders: [
        createStopRow('Anchor', 'D', '0'),
        createStopRow('Halfway', 'B', '1'),
        createStopRow('Terminal', 'A', '2'),
      ],
    })
    const substituteBack = createJourney({
      key: 'sub_back',
      pauseBeforeDeparture: '1',
      orders: [
        createStopRow('Terminal', 'A', '0'),
        createStopRow('Halfway', 'C', '2'),
        createStopRow('Anchor', 'C', '3'),
      ],
    })
    const baseOrders = [
      createShiftOrder(1, [
        createTimeNode('04:30'),
        {
          id: 'loop-base-node-1',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:40',
        },
      ]),
      createShiftOrder(2, [
        createTimeNode('04:35'),
        {
          id: 'loop-base-node-2',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:45',
        },
      ]),
      createShiftOrder(3, [
        createTimeNode('04:40'),
        {
          id: 'loop-base-node-3',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:50',
        },
      ]),
      createShiftOrder(4, [
        createTimeNode('04:45'),
        {
          id: 'loop-base-node-4',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:55',
        },
      ]),
    ]
    const document = {
      journeys: [substituteOut, substituteBack],
      shiftOrders: [createShiftOrder(9, [createTimeNode('04:20')])],
    }
    const templates = [
      { dutyLabel: 'Duty A', journeyIds: [substituteOut.id, substituteBack.id] },
      { dutyLabel: 'Duty B', journeyIds: [substituteOut.id, substituteBack.id] },
    ]
    const preview = buildSubstituteServicePlannerPreview({
      baseJourneys: [baseLoopJourney],
      journeys: [substituteOut, substituteBack],
      maxDesiredBreakMinutes: 8,
      minBreakMinutes: 3,
      routes: [],
      shiftOrders: baseOrders,
      templates,
    })

    const appendedPlan = appendSubstituteServicePlan({
      document,
      journeyOptions: document.journeys.map((journey) => ({
        id: journey.id,
        journey,
        source: 'current' as const,
      })),
      preview,
      routes: [],
      templates,
    })

    expect(appendedPlan.createdOrders).toHaveLength(2)
    expect(appendedPlan.journeyChanges).toEqual([])
    expect(appendedPlan.createdOrders.map((order) => order.orderNumber)).toEqual([10, 11])
    expect(appendedPlan.createdOrders[0]?.nodes).toMatchObject([
      { kind: 'time', time: '04:30' },
      { kind: 'journeys', journeyIds: [substituteOut.id, substituteBack.id], loopUntil: '05:45' },
    ])
    expect(appendedPlan.createdOrders[1]?.nodes).toMatchObject([
      { kind: 'time', time: '04:35' },
      { kind: 'journeys', journeyIds: [substituteOut.id, substituteBack.id], loopUntil: '05:50' },
    ])
  })

  it('clones and retimes the first substitute leg when the selected loop is shorter than the duty spacing', () => {
    const baseLoopJourney = createJourney({
      key: 'base_loop',
      pauseBeforeDeparture: '4',
      orders: [
        createStopRow('Anchor', 'A', '0'),
        createStopRow('Terminal', 'B', '16'),
      ],
    })
    const substituteOut = createJourney({
      key: 'sub_out',
      orders: [
        createStopRow('Anchor', 'D', '0'),
        createStopRow('Halfway', 'B', '1'),
        createStopRow('Terminal', 'A', '2'),
      ],
    })
    const substituteBack = createJourney({
      key: 'sub_back',
      orders: [
        createStopRow('Terminal', 'A', '0'),
        createStopRow('Halfway', 'C', '2'),
        createStopRow('Anchor', 'C', '3'),
      ],
    })
    const baseOrders = [
      createShiftOrder(1, [
        createTimeNode('04:30'),
        {
          id: 'loop-base-node-1',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:40',
        },
      ]),
      createShiftOrder(2, [
        createTimeNode('04:35'),
        {
          id: 'loop-base-node-2',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:45',
        },
      ]),
      createShiftOrder(3, [
        createTimeNode('04:40'),
        {
          id: 'loop-base-node-3',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:50',
        },
      ]),
      createShiftOrder(4, [
        createTimeNode('04:45'),
        {
          id: 'loop-base-node-4',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:55',
        },
      ]),
    ]
    const document = {
      journeys: [substituteOut, substituteBack],
      shiftOrders: [createShiftOrder(9, [createTimeNode('04:20')])],
    }
    const templates = [
      { dutyLabel: 'Duty A', journeyIds: [substituteOut.id, substituteBack.id] },
      { dutyLabel: 'Duty B', journeyIds: [substituteOut.id, substituteBack.id] },
    ]
    const preview = buildSubstituteServicePlannerPreview({
      baseJourneys: [baseLoopJourney],
      journeys: [substituteOut, substituteBack],
      maxDesiredBreakMinutes: 8,
      minBreakMinutes: 3,
      routes: [],
      shiftOrders: baseOrders,
      templates,
    })

    const appendedPlan = appendSubstituteServicePlan({
      document,
      journeyOptions: document.journeys.map((journey) => ({
        id: journey.id,
        journey,
        source: 'current' as const,
      })),
      preview,
      routes: [],
      templates,
    })

    expect(appendedPlan.createdOrders).toHaveLength(2)
    expect(appendedPlan.importedJourneys).toHaveLength(0)
    expect(appendedPlan.journeyChanges).toMatchObject([
      {
        dutyLabel: 'Duty A, Duty B',
        kind: 'current-retime',
        pauseBeforeJourneyAfter: '5',
        pauseBeforeJourneyBefore: '',
        resultingJourneyKey: 'sub_out',
        sourceJourneyKey: 'sub_out',
      },
    ])
    expect(appendedPlan.document.journeys.find((journey) => journey.id === substituteOut.id)?.pauseBeforeJourney).toBe('5')
    expect(appendedPlan.document.journeys.find((journey) => journey.id === substituteBack.id)?.pauseBeforeJourney).toBe('')
    expect(appendedPlan.createdOrders[0]?.nodes).toMatchObject([
      { kind: 'time', time: '04:29' },
      { kind: 'journeys', journeyIds: [substituteOut.id, substituteBack.id], loopUntil: '05:45' },
    ])
    expect(appendedPlan.createdOrders[1]?.nodes).toMatchObject([
      { kind: 'time', time: '04:34' },
      { kind: 'journeys', journeyIds: [substituteOut.id, substituteBack.id], loopUntil: '05:50' },
    ])
  })
})