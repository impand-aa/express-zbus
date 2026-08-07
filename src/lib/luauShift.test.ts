import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { generateShiftModuleSource, parseShiftModuleSource } from './luauShift'
import type { JourneyDefinition, ShiftDocument, ShiftOrder, ShiftPlanNode } from '../types'

function loadShiftSource(relativePath: string) {
  const absolutePath = fileURLToPath(new URL(`../../${relativePath}`, import.meta.url))
  return readFileSync(absolutePath, 'utf8')
}

function comparableNodes(nodes: ShiftPlanNode[], journeyKeyById: Map<string, string>) {
  return nodes.map((node) => {
    if (node.kind === 'time') {
      return {
        kind: node.kind,
        time: node.time,
      }
    }

    return {
      kind: node.kind,
      journeyKeys: node.journeyIds.map((journeyId) => journeyKeyById.get(journeyId)),
      loopUntil: node.loopUntil,
    }
  })
}

function comparableJourneys(journeys: JourneyDefinition[]) {
  return journeys.map((journey) => ({
    key: journey.key,
    lineDisplay: journey.lineDisplay,
    from: journey.from,
    to: journey.to,
    pauseBeforeJourney: journey.pauseBeforeJourney,
    pauseAfterJourney: journey.pauseAfterJourney,
    orders: journey.orders.map((row) => ({
      type: row.type,
      args: row.args.map((argument) => ({
        kind: argument.kind,
        value: argument.value,
      })),
    })),
  }))
}

function comparableOrdersWithJourneys(orders: ShiftOrder[], journeys: JourneyDefinition[]) {
  const journeyKeyById = new Map(journeys.map((journey) => [journey.id, journey.key]))
  return orders.map((order) => ({
    orderNumber: order.orderNumber,
    nodes: comparableNodes(order.nodes, journeyKeyById),
  }))
}

function comparableDocument(document: ShiftDocument) {
  return {
    journeys: comparableJourneys(document.journeys),
    shiftOrders: comparableOrdersWithJourneys(document.shiftOrders, document.journeys),
  }
}

describe('parseShiftModuleSource', () => {
  it('parses line 34 sample shifts from the Roblox project', () => {
    const source = loadShiftSource('BUSEV3_source/Shifts/34/moduleScript.luau')
    const document = parseShiftModuleSource(source)

    expect(document.journeys).toHaveLength(8)
    expect(document.shiftOrders).toHaveLength(3)
    expect(document.journeys[0]?.key).toBe('manipulation_to_fabriky')
    expect(document.shiftOrders[0]?.nodes[0]).toMatchObject({
      kind: 'time',
      time: '04:39',
    })
  })

  it('supports string line displays and custom advance orders', () => {
    const source = loadShiftSource('BUSEV3_source/Shifts/847/moduleScript.luau')
    const document = parseShiftModuleSource(source)

    expect(document.journeys[0]?.lineDisplay).toEqual({
      kind: 'string',
      value: 'X47',
    })
    expect(document.journeys[0]?.orders[4]).toMatchObject({
      type: 'advance',
    })
  })

  it('round-trips a real project shift through the generator', () => {
    const source = loadShiftSource('BUSEV3_source/Shifts/47/moduleScript.luau')
    const parsed = parseShiftModuleSource(source)
    const generated = generateShiftModuleSource(parsed)
    const roundTripped = parseShiftModuleSource(generated)

    expect(comparableDocument(roundTripped)).toEqual(comparableDocument(parsed))
  })

  it('round-trips pause-before and pause-after journey fields', () => {
    const source = loadShiftSource('BUSEV3_source/Shifts/47/moduleScript.luau')
    const parsed = parseShiftModuleSource(source)

    parsed.journeys[0]!.pauseBeforeJourney = '7'
    parsed.journeys[0]!.pauseAfterJourney = '2'

    const roundTripped = parseShiftModuleSource(generateShiftModuleSource(parsed))

    expect(roundTripped.journeys[0]).toMatchObject({
      pauseBeforeJourney: '7',
      pauseAfterJourney: '2',
    })
  })

  it('exports an empty line display as nil instead of failing validation', () => {
    const source = loadShiftSource('BUSEV3_source/Shifts/47/moduleScript.luau')
    const parsed = parseShiftModuleSource(source)

    parsed.journeys[0]!.lineDisplay = {
      kind: 'string',
      value: '',
    }

    const roundTripped = parseShiftModuleSource(generateShiftModuleSource(parsed))

    expect(roundTripped.journeys[0]?.lineDisplay).toEqual({
      kind: 'nil',
      value: '',
    })
  })

  it('exports numeric-only line displays as numbers even if they were stored as strings', () => {
    const source = loadShiftSource('BUSEV3_source/Shifts/47/moduleScript.luau')
    const parsed = parseShiftModuleSource(source)

    parsed.journeys[0]!.lineDisplay = {
      kind: 'string',
      value: '47',
    }

    const roundTripped = parseShiftModuleSource(generateShiftModuleSource(parsed))

    expect(roundTripped.journeys[0]?.lineDisplay).toEqual({
      kind: 'number',
      value: '47',
    })
  })

  it('round-trips announcement order rows', () => {
    const source = loadShiftSource('BUSEV3_source/Shifts/47/moduleScript.luau')
    const parsed = parseShiftModuleSource(source)

    parsed.journeys[0]!.orders.push({
      id: 'announcement-row',
      type: 'announcement',
      args: [
        { id: 'announcement-type', kind: 'string', value: 'depart' },
        { id: 'announcement-value', kind: 'string', value: 'gong/next_stop/Hlavná stanica' },
      ],
    })

    const roundTripped = parseShiftModuleSource(generateShiftModuleSource(parsed))

    expect(roundTripped.journeys[0]?.orders.at(-1)).toMatchObject({
      type: 'announcement',
      args: [
        { kind: 'string', value: 'depart' },
        { kind: 'string', value: 'gong/next_stop/Hlavná stanica' },
      ],
    })
  })
})