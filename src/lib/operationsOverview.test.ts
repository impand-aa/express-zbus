import { describe, expect, it } from 'vitest'

import { createJourney, createJourneyNode, createShiftOrder, createStopRow, createTimeNode } from './document'
import { buildOperationsOverviewData } from './operationsOverview'
import type { ShiftDocument } from '../types'

describe('operations overview', () => {
  it('aggregates stop departures across multiple shift documents and keeps platform data', () => {
    const toCenter = createJourney({
      key: 'to_center',
      lineDisplay: { kind: 'number', value: '95' },
      from: 'Depot',
      to: 'Center',
      orders: [
        createStopRow('Depot', 'A', '0'),
        createStopRow('Fabriky', 'A', '4'),
        createStopRow('Center', 'A', '10'),
      ],
    })
    const toEstate = createJourney({
      key: 'to_estate',
      lineDisplay: { kind: 'number', value: '80' },
      from: 'Center',
      to: 'Estate',
      orders: [
        createStopRow('Center', 'B', '0'),
        createStopRow('Fabriky', 'B', '6'),
        createStopRow('Estate', 'A', '13'),
      ],
    })
    const firstDocument: ShiftDocument = {
      journeys: [toCenter],
      shiftOrders: [
        createShiftOrder(1, [createTimeNode('04:30'), createJourneyNode([toCenter.id])]),
      ],
    }
    const secondDocument: ShiftDocument = {
      journeys: [toEstate],
      shiftOrders: [
        createShiftOrder(2, [createTimeNode('05:00'), createJourneyNode([toEstate.id])]),
      ],
    }

    const overview = buildOperationsOverviewData([firstDocument, secondDocument], [])
    const fabrikyDepartures = overview.departures.filter((departure) => departure.stopKey === 'Fabriky')

    expect(overview.stopOptions.find((stopOption) => stopOption.key === 'Fabriky')).toMatchObject({
      departureCount: 2,
      firstDepartureTime: '04:34',
      lastDepartureTime: '05:06',
      label: 'Fabriky',
      platformCount: 2,
      platforms: ['A', 'B'],
    })
    expect(fabrikyDepartures.map((departure) => departure.departureTime)).toEqual(['04:34', '05:06'])
    expect(fabrikyDepartures.map((departure) => departure.platform)).toEqual(['A', 'B'])
    expect(fabrikyDepartures.map((departure) => departure.direction)).toEqual(['Center', 'Estate'])
    expect(fabrikyDepartures.map((departure) => departure.lineDisplayPreview?.text)).toEqual(['95', '80'])
  })

  it('rounds fractional departure strings down to whole minutes for the overview display', () => {
    const firstJourney = createJourney({
      key: 'fractional_a',
      lineDisplay: { kind: 'number', value: '15' },
      from: 'Depot',
      to: 'Center',
      orders: [
        createStopRow('Depot', 'A', '0'),
        createStopRow('Fabriky', 'A', '1.5'),
      ],
    })
    const secondJourney = createJourney({
      key: 'fractional_b',
      lineDisplay: { kind: 'number', value: '16' },
      from: 'Depot',
      to: 'Center',
      orders: [
        createStopRow('Depot', 'A', '0'),
        createStopRow('Fabriky', 'A', '2.25'),
      ],
    })

    const overview = buildOperationsOverviewData([
      {
        journeys: [firstJourney],
        shiftOrders: [
          createShiftOrder(1, [createTimeNode('04:30'), createJourneyNode([firstJourney.id])]),
        ],
      },
      {
        journeys: [secondJourney],
        shiftOrders: [
          createShiftOrder(2, [createTimeNode('05:00'), createJourneyNode([secondJourney.id])]),
        ],
      },
    ], [])

    const fabrikyStop = overview.stopOptions.find((stopOption) => stopOption.key === 'Fabriky')
    const fabrikyDepartures = overview.departures.filter((departure) => departure.stopKey === 'Fabriky')

    expect(fabrikyStop).toMatchObject({
      firstDepartureTime: '04:31',
      lastDepartureTime: '05:02',
    })
    expect(fabrikyDepartures.map((departure) => departure.departureTime)).toEqual(['04:31', '05:02'])
  })
})