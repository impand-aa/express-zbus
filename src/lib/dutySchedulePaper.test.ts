import { describe, expect, it } from 'vitest'

import { createJourney, createJourneyNode, createShiftOrder, createStopRow, createTimeNode } from './document'
import { buildDutySchedulePaperPreview } from './dutySchedulePaper'

describe('duty schedule paper', () => {
  it('builds stop options, default stop selection, and trip columns from a duty timeline', () => {
    const toStation = createJourney({
      key: 'to_station',
      lineDisplay: { kind: 'number', value: '22' },
      orders: [
        createStopRow('Depot', 'A', '0'),
        createStopRow('Square', 'B', '4'),
        createStopRow('Station', 'C', '8'),
      ],
    })
    const toEstate = createJourney({
      key: 'to_estate',
      lineDisplay: { kind: 'number', value: '22' },
      orders: [
        createStopRow('Station', 'C', '0'),
        createStopRow('Market', 'A', '2'),
        createStopRow('Estate', 'D', '4'),
      ],
    })
    const order = createShiftOrder(1, [
      createTimeNode('17:51'),
      createJourneyNode([toStation.id, toEstate.id]),
    ])

    const preview = buildDutySchedulePaperPreview(order, [toStation, toEstate], [])

    expect(preview.lineDisplayText).toBe('22')
    expect(preview.lineDisplayPreview).toMatchObject({
      text: '22',
    })
    expect(preview.stopOptions.map((stopOption) => stopOption.label)).toEqual([
      'Depot / A',
      'Square / B',
      'Station / C',
      'Market / A',
      'Estate / D',
    ])
    expect(preview.defaultSelectedStopKeys).toEqual([
      'Depot::A',
      'Station::C',
      'Estate::D',
    ])
    expect(preview.startsWithSummary).toBe('17:51 Depot / A -> 17:59 Station / C')
    expect(preview.endsWithSummary).toBe('17:59 Station / C -> 18:03 Estate / D')
    expect(preview.tripColumns).toHaveLength(2)
    expect(preview.tripColumns[0]).toMatchObject({
      journeyKey: 'to_station',
      originStopKey: 'Depot::A',
      endStopKey: 'Station::C',
      subtitle: '17:51 - 17:59',
      title: 'Depot -> Station',
    })
    expect(preview.tripColumns[0]?.timesByStopKey).toMatchObject({
      'Depot::A': '17:51',
      'Square::B': '17:55',
      'Station::C': '17:59',
    })
    expect(preview.tripColumns[1]?.timesByStopKey).toMatchObject({
      'Station::C': '17:59',
      'Market::A': '18:01',
      'Estate::D': '18:03',
    })
  })
})