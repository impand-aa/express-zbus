import { describe, expect, it } from 'vitest'

import { createJourney, createShiftOrder, createStopRow, createTimeNode } from './document'
import { buildSubstituteServiceDemoPreview, getTemplateInterchangeOptions } from './substituteServiceDemo'

describe('substitute service demo preview', () => {
  it('counts pause after journey in runtime while excluding pause before journey', () => {
    const outboundJourney = createJourney({
      key: 'to_short_turn',
      pauseBeforeJourney: '2',
      pauseAfterJourney: '1',
      orders: [
        createStopRow('A', '1', '0'),
        createStopRow('B', '1', '2'),
      ],
    })
    const inboundJourney = createJourney({
      key: 'from_short_turn',
      pauseBeforeJourney: '1',
      pauseAfterJourney: '2',
      orders: [
        createStopRow('B', '2', '0'),
        createStopRow('A', '2', '2'),
      ],
    })
    const baseOrders = [
      createShiftOrder(1, [createTimeNode('04:30')]),
      createShiftOrder(2, [createTimeNode('04:40')]),
    ]

    const preview = buildSubstituteServiceDemoPreview({
      journeys: [outboundJourney, inboundJourney],
      maxDesiredBreakMinutes: 20,
      minBreakMinutes: 1,
      routes: [],
      shiftOrders: baseOrders,
      templates: [{ journeyIds: [outboundJourney.id, inboundJourney.id] }],
    })

    expect(preview.dutyPreviews[0]).toMatchObject({
      runtimeMinutes: 7,
      status: 'good',
    })
    expect(preview.dutyPreviews[0]?.assignedOrders[0]?.availableBreakMinutes).toBe(3)
  })

  it('flags one substitute duty as impossible when the next base departure leaves too little break', () => {
    const outboundJourney = createJourney({
      key: 'to_short_turn',
      pauseBeforeDeparture: '2',
      orders: [
        createStopRow('A', '1', '0'),
        createStopRow('B', '1', '2'),
      ],
    })
    const inboundJourney = createJourney({
      key: 'from_short_turn',
      pauseBeforeDeparture: '1',
      orders: [
        createStopRow('B', '2', '0'),
        createStopRow('A', '2', '2'),
      ],
    })
    const baseOrders = [
      createShiftOrder(1, [createTimeNode('04:30')]),
      createShiftOrder(2, [createTimeNode('04:35')]),
      createShiftOrder(3, [createTimeNode('04:40')]),
      createShiftOrder(4, [createTimeNode('04:45')]),
    ]

    const preview = buildSubstituteServiceDemoPreview({
      journeys: [outboundJourney, inboundJourney],
      maxDesiredBreakMinutes: 8,
      minBreakMinutes: 3,
      routes: [],
      shiftOrders: baseOrders,
      templates: [{ journeyIds: [outboundJourney.id, inboundJourney.id] }],
    })

    expect(preview.overallStatus).toBe('impossible')
    expect(preview.dutyPreviews[0]).toMatchObject({
      coverageOrderNumbers: [1, 2, 3, 4],
      runtimeMinutes: 4,
      status: 'impossible',
    })
  })

  it('supports round-robin coverage with retained break for two substitute duties', () => {
    const outboundJourney = createJourney({
      key: 'to_short_turn',
      pauseBeforeDeparture: '2',
      orders: [
        createStopRow('A', '1', '0'),
        createStopRow('B', '1', '2'),
      ],
    })
    const inboundJourney = createJourney({
      key: 'from_short_turn',
      pauseBeforeDeparture: '1',
      orders: [
        createStopRow('B', '2', '0'),
        createStopRow('A', '2', '2'),
      ],
    })
    const baseOrders = [
      createShiftOrder(1, [createTimeNode('04:30')]),
      createShiftOrder(2, [createTimeNode('04:35')]),
      createShiftOrder(3, [createTimeNode('04:40')]),
      createShiftOrder(4, [createTimeNode('04:45')]),
    ]

    const preview = buildSubstituteServiceDemoPreview({
      journeys: [outboundJourney, inboundJourney],
      maxDesiredBreakMinutes: 8,
      minBreakMinutes: 3,
      routes: [],
      shiftOrders: baseOrders,
      templates: [
        { dutyLabel: 'Duty A', journeyIds: [outboundJourney.id, inboundJourney.id] },
        { dutyLabel: 'Duty B', journeyIds: [outboundJourney.id, inboundJourney.id] },
      ],
    })

    expect(preview.overallStatus).toBe('good')
    expect(preview.averageHeadwayMinutes).toBe(5)
    expect(preview.dutyPreviews[0]).toMatchObject({
      coverageOrderNumbers: [1, 3],
      runtimeMinutes: 4,
      status: 'good',
    })
    expect(preview.dutyPreviews[0]?.assignedOrders[0]?.startTime).toBe('04:30')
    expect(preview.dutyPreviews[0]?.assignedOrders[0]?.availableBreakMinutes).toBe(6)
    expect(preview.dutyPreviews[1]).toMatchObject({
      coverageOrderNumbers: [2, 4],
      runtimeMinutes: 4,
      status: 'good',
    })
    expect(preview.dutyPreviews[1]?.assignedOrders[0]?.startTime).toBe('04:35')
    expect(preview.dutyPreviews[1]?.assignedOrders[0]?.availableBreakMinutes).toBe(6)
  })

  it('aligns suggested duty start times to the first matching base stop instead of the raw base start', () => {
    const baseTripToDepot = createJourney({
      key: 'manipulation_to_fabriky',
      orders: [
        createStopRow('Depo Fabriky', 'A', '0'),
        createStopRow('Fabriky', 'B', '1'),
      ],
    })
    const baseTripToPark = createJourney({
      key: 'journey_to_park',
      pauseBeforeDeparture: '8',
      orders: [
        createStopRow('Fabriky', 'A', '0'),
        createStopRow('Armadna', 'C', '1'),
        createStopRow('Priekopnicka', 'B', '3'),
        createStopRow('Mestsky park', 'A', '6'),
      ],
    })
    const substituteToPark = createJourney({
      key: 'variant_0_to_park',
      pauseBeforeDeparture: '4',
      orders: [
        createStopRow('Priekopnicka', 'D', '0'),
        createStopRow('Galeria', 'B', '1'),
        createStopRow('Mestsky park', 'A', '3'),
      ],
    })
    const substituteToTurnback = createJourney({
      key: 'variant_0_to_priekopnicka',
      orders: [
        createStopRow('Mestsky park', 'A', '0'),
        createStopRow('Galeria', 'A', '2'),
        createStopRow('Priekopnicka', 'C', '3'),
      ],
    })
    const baseOrders = [
      createShiftOrder(1, [
        createTimeNode('04:30'),
        {
          id: 'journey-node-1',
          kind: 'journeys',
          journeyIds: [baseTripToDepot.id, baseTripToPark.id],
          loopUntil: '',
        },
      ]),
      createShiftOrder(2, [
        createTimeNode('04:35'),
        {
          id: 'journey-node-2',
          kind: 'journeys',
          journeyIds: [baseTripToDepot.id, baseTripToPark.id],
          loopUntil: '',
        },
      ]),
    ]

    const preview = buildSubstituteServiceDemoPreview({
      baseJourneys: [baseTripToDepot, baseTripToPark],
      journeys: [substituteToPark, substituteToTurnback],
      maxDesiredBreakMinutes: 8,
      minBreakMinutes: 3,
      routes: [],
      shiftOrders: baseOrders,
      templates: [{ journeyIds: [substituteToPark.id, substituteToTurnback.id] }],
    })

    expect(preview.dutyPreviews[0]?.assignedOrders[0]).toMatchObject({
      baseAnchorTime: '04:42',
      matchedStopName: 'Priekopnicka',
      startTime: '04:38',
    })
    expect(preview.dutyPreviews[0]?.assignedOrders[1]).toMatchObject({
      baseAnchorTime: '04:47',
      matchedStopName: 'Priekopnicka',
      startTime: '04:43',
    })
  })

  it('calculates break from the base loop recurrence when four substitute duties each cover one base order', () => {
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
        createStopRow('Terminal', 'A', '2'),
      ],
    })
    const substituteBack = createJourney({
      key: 'sub_back',
      orders: [
        createStopRow('Terminal', 'A', '0'),
        createStopRow('Anchor', 'C', '2'),
      ],
    })
    const baseOrders = [
      createShiftOrder(1, [
        createTimeNode('04:30'),
        {
          id: 'base-node-1',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:40',
        },
      ]),
      createShiftOrder(2, [
        createTimeNode('04:35'),
        {
          id: 'base-node-2',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:45',
        },
      ]),
      createShiftOrder(3, [
        createTimeNode('04:40'),
        {
          id: 'base-node-3',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:50',
        },
      ]),
      createShiftOrder(4, [
        createTimeNode('04:45'),
        {
          id: 'base-node-4',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:55',
        },
      ]),
    ]

    const preview = buildSubstituteServiceDemoPreview({
      baseJourneys: [baseLoopJourney],
      journeys: [substituteOut, substituteBack],
      maxDesiredBreakMinutes: 30,
      minBreakMinutes: 3,
      routes: [],
      shiftOrders: baseOrders,
      templates: [
        { journeyIds: [substituteOut.id, substituteBack.id] },
        { journeyIds: [substituteOut.id, substituteBack.id] },
        { journeyIds: [substituteOut.id, substituteBack.id] },
        { journeyIds: [substituteOut.id, substituteBack.id] },
      ],
    })

    expect(preview.dutyPreviews[0]).toMatchObject({
      coverageOrderNumbers: [1],
      runtimeMinutes: 4,
      status: 'good',
    })
    expect(preview.dutyPreviews[0]?.assignedOrders[0]).toMatchObject({
      startTime: '04:30',
      gapMinutes: 20,
      availableBreakMinutes: 16,
    })
    expect(preview.dutyPreviews[3]?.assignedOrders[0]).toMatchObject({
      startTime: '04:45',
      gapMinutes: 20,
      availableBreakMinutes: 16,
    })
  })

  it('uses the next assigned order in the following cycle for alternating-duty gaps', () => {
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
        createStopRow('Terminal', 'A', '2'),
      ],
    })
    const substituteBack = createJourney({
      key: 'sub_back',
      orders: [
        createStopRow('Terminal', 'A', '0'),
        createStopRow('Anchor', 'C', '2'),
      ],
    })
    const baseOrders = [
      createShiftOrder(1, [
        createTimeNode('04:30'),
        {
          id: 'alt-base-node-1',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:40',
        },
      ]),
      createShiftOrder(2, [
        createTimeNode('04:35'),
        {
          id: 'alt-base-node-2',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:45',
        },
      ]),
      createShiftOrder(3, [
        createTimeNode('04:40'),
        {
          id: 'alt-base-node-3',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:50',
        },
      ]),
      createShiftOrder(4, [
        createTimeNode('04:45'),
        {
          id: 'alt-base-node-4',
          kind: 'journeys',
          journeyIds: [baseLoopJourney.id],
          loopUntil: '05:55',
        },
      ]),
    ]

    const preview = buildSubstituteServiceDemoPreview({
      baseJourneys: [baseLoopJourney],
      journeys: [substituteOut, substituteBack],
      maxDesiredBreakMinutes: 30,
      minBreakMinutes: 3,
      routes: [],
      shiftOrders: baseOrders,
      templates: [
        { dutyLabel: 'Duty A', journeyIds: [substituteOut.id, substituteBack.id] },
        { dutyLabel: 'Duty B', journeyIds: [substituteOut.id, substituteBack.id] },
      ],
    })

    expect(preview.dutyPreviews[0]?.assignedOrders[0]).toMatchObject({
      nextOrderNumber: 3,
      gapMinutes: 10,
      availableBreakMinutes: 6,
    })
    expect(preview.dutyPreviews[0]?.assignedOrders[1]).toMatchObject({
      nextOrderNumber: 1,
      gapMinutes: 10,
      availableBreakMinutes: 6,
    })
    expect(preview.dutyPreviews[1]?.assignedOrders[0]).toMatchObject({
      nextOrderNumber: 4,
      gapMinutes: 10,
      availableBreakMinutes: 6,
    })
    expect(preview.dutyPreviews[1]?.assignedOrders[1]).toMatchObject({
      nextOrderNumber: 2,
      gapMinutes: 10,
      availableBreakMinutes: 6,
    })
  })

  it('allows an explicit interchange stop selection for variant_1 style journeys', () => {
    const baseTripToDepot = createJourney({
      key: 'manipulation_to_fabriky',
      orders: [
        createStopRow('Depo Fabriky', 'A', '0'),
        createStopRow('Fabriky', 'B', '1'),
      ],
    })
    const baseTripToPark = createJourney({
      key: 'journey_to_park',
      pauseBeforeDeparture: '8',
      orders: [
        createStopRow('Fabriky', 'A', '0'),
        createStopRow('Armadna', 'C', '1'),
        createStopRow('Priekopnicka', 'B', '3'),
        createStopRow('Mestsky park', 'A', '6'),
      ],
    })
    const substituteToPriekopnicka = createJourney({
      key: 'variant_1_to_priekopnicka',
      pauseBeforeDeparture: '3',
      orders: [
        createStopRow('Fabriky', 'A', '0'),
        createStopRow('Armadna', 'C', '1'),
        createStopRow('Clementisova', 'A', '1'),
        createStopRow('Priekopnicka', 'B', '3'),
      ],
    })
    const substituteToFabriky = createJourney({
      key: 'variant_1_to_fabriky',
      pauseBeforeDeparture: '1',
      orders: [
        createStopRow('Priekopnicka', 'A', '0'),
        createStopRow('Clementisova', 'B', '1'),
        createStopRow('Armadna', 'D', '2'),
        createStopRow('Fabriky', 'B', '3'),
      ],
    })
    const baseOrders = [
      createShiftOrder(1, [
        createTimeNode('04:30'),
        {
          id: 'variant1-base-node-1',
          kind: 'journeys',
          journeyIds: [baseTripToDepot.id, baseTripToPark.id],
          loopUntil: '',
        },
      ]),
      createShiftOrder(2, [
        createTimeNode('04:35'),
        {
          id: 'variant1-base-node-2',
          kind: 'journeys',
          journeyIds: [baseTripToDepot.id, baseTripToPark.id],
          loopUntil: '',
        },
      ]),
    ]
    const interchangeOptions = getTemplateInterchangeOptions(
      [substituteToPriekopnicka.id, substituteToFabriky.id],
      [substituteToPriekopnicka, substituteToFabriky],
      [],
    )
    const priekopnickaInterchange = interchangeOptions.find((option) => option.stopName === 'Priekopnicka' && option.platform === 'B')

    expect(priekopnickaInterchange).toBeDefined()

    const preview = buildSubstituteServiceDemoPreview({
      baseJourneys: [baseTripToDepot, baseTripToPark],
      journeys: [substituteToPriekopnicka, substituteToFabriky],
      maxDesiredBreakMinutes: 8,
      minBreakMinutes: 3,
      routes: [],
      shiftOrders: baseOrders,
      templates: [{
        interchangeKey: priekopnickaInterchange?.key,
        journeyIds: [substituteToPriekopnicka.id, substituteToFabriky.id],
      }],
    })

    expect(preview.dutyPreviews[0]?.selectedInterchangeLabel).toBe('Priekopnicka / B')
    expect(preview.dutyPreviews[0]?.assignedOrders[0]).toMatchObject({
      baseAnchorTime: '04:42',
      matchedPlatform: 'B',
      matchedStopName: 'Priekopnicka',
      startTime: '04:36',
    })
    expect(preview.dutyPreviews[0]?.assignedOrders[1]).toMatchObject({
      baseAnchorTime: '04:47',
      matchedPlatform: 'B',
      matchedStopName: 'Priekopnicka',
      startTime: '04:41',
    })
  })
})