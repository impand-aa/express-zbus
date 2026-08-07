import type {
  DocumentValidationResult,
  JourneyDefinition,
  JourneyOrderArgument,
  JourneyOrderRow,
  JourneyPlanNode,
  ScalarKind,
  ShiftDocument,
  ShiftOrder,
  TimePlanNode,
} from '../types'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

type JourneyDefinitionOverrides = Partial<JourneyDefinition> & {
  pauseBeforeDeparture?: string
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function createJourneyArgument(kind: ScalarKind = 'string', value = ''): JourneyOrderArgument {
  return {
    id: createId('arg'),
    kind,
    value,
  }
}

export function createJourneyOrderRow(type = 'stop', args: JourneyOrderArgument[] = []): JourneyOrderRow {
  return {
    id: createId('row'),
    type,
    args,
  }
}

export function inferLineDisplayValue(value: string) {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return {
      kind: 'nil',
      value: '',
    } as const
  }

  return {
    kind: /[^0-9]/.test(normalizedValue) ? 'string' : 'number',
    value: normalizedValue,
  } as const
}

export function cloneJourneyOrderRow(row: JourneyOrderRow) {
  return createJourneyOrderRow(
    row.type,
    row.args.map((argument) => createJourneyArgument(argument.kind, argument.value)),
  )
}

export function cloneJourneyOrderRows(rows: JourneyOrderRow[]) {
  return rows.map((row) => cloneJourneyOrderRow(row))
}

export function createPanelRow(panelId = '910') {
  return createJourneyOrderRow('panel', [createJourneyArgument('number', panelId)])
}

export function createStopRow(stopName = '', platform = 'A', minuteOffset = '') {
  const args = [
    createJourneyArgument('string', stopName),
    createJourneyArgument('string', platform),
  ]

  if (minuteOffset !== '') {
    args.push(createJourneyArgument('number', minuteOffset))
  }

  return createJourneyOrderRow('stop', args)
}

export function createAdvanceRow() {
  return createJourneyOrderRow('advance', [])
}

export function createAnnouncementRow(trigger = 'new', announceString = '') {
  return createJourneyOrderRow('announcement', [
    createJourneyArgument('string', trigger),
    createJourneyArgument('string', announceString),
  ])
}

export function createCustomRow() {
  return createJourneyOrderRow('custom', [createJourneyArgument('string', '')])
}

export function createJourney(overrides: JourneyDefinitionOverrides = {}): JourneyDefinition {
  const {
    pauseBeforeDeparture,
    pauseBeforeJourney = pauseBeforeDeparture ?? '',
    pauseAfterJourney = '',
    ...remainingOverrides
  } = overrides

  return {
    id: createId('journey'),
    key: 'journey_block',
    lineDisplay: {
      kind: 'nil',
      value: '', // Default line display value upon journey creation
    },
    from: '',
    to: '',
    pauseBeforeJourney,
    pauseAfterJourney,
    orders: [],
    ...remainingOverrides,
  }
}

export function createTimeNode(time = '04:30', allowBackwardTime = true): TimePlanNode {
  return {
    id: createId('node'),
    kind: 'time',
    time,
    allowBackwardTime,
  }
}

export function createJourneyNode(journeyIds: string[] = []): JourneyPlanNode {
  return {
    id: createId('node'),
    kind: 'journeys',
    journeyIds,
    loopUntil: '',
  }
}

export function createShiftOrder(orderNumber: number, nodes: Array<TimePlanNode | JourneyPlanNode> = []): ShiftOrder {
  return {
    id: createId('shift-order'),
    orderNumber,
    nodes,
  }
}

export function createEmptyDocument(): ShiftDocument {
  const journey = createJourney({ key: 'journey_1' })

  return {
    journeys: [journey],
    shiftOrders: [
      createShiftOrder(1, [
        createTimeNode('04:30'),
        createJourneyNode([journey.id]),
      ]),
    ],
  }
}

export function sanitizeJourneyKey(input: string) {
  const trimmed = input.trim()
  const collapsed = trimmed
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+/g, '_')

  const fallback = collapsed.length > 0 ? collapsed : 'journey_block'

  if (/^[0-9]/.test(fallback)) {
    return `journey_${fallback}`
  }

  return fallback
}

export function buildUniqueJourneyKey(journeys: JourneyDefinition[], preferredKey: string, excludedJourneyId?: string) {
  const baseKey = sanitizeJourneyKey(preferredKey)
  let candidate = baseKey
  let suffix = 2

  const conflicts = (value: string) => journeys.some((journey) => journey.id !== excludedJourneyId && journey.key === value)

  while (conflicts(candidate)) {
    candidate = `${baseKey}_${suffix}`
    suffix += 1
  }

  return candidate
}

export function duplicateJourneyDefinition(journey: JourneyDefinition, journeys: JourneyDefinition[]) {
  return createJourney({
    key: buildUniqueJourneyKey(journeys, `${journey.key}_copy`),
    lineDisplay: { ...journey.lineDisplay },
    from: journey.from,
    to: journey.to,
    pauseBeforeJourney: journey.pauseBeforeJourney,
    pauseAfterJourney: journey.pauseAfterJourney,
    orders: cloneJourneyOrderRows(journey.orders),
  })
}

export function getNextShiftOrderNumber(document: ShiftDocument) {
  const currentMax = document.shiftOrders.reduce((maxValue, order) => Math.max(maxValue, order.orderNumber), 0)
  return currentMax + 1
}

export function shiftClockValue(value: string, deltaMinutes: number) {
  if (!TIME_PATTERN.test(value)) {
    return value
  }

  const [hoursText, minutesText] = value.split(':')
  const totalMinutes = Number(hoursText) * 60 + Number(minutesText)
  const shifted = ((totalMinutes + deltaMinutes) % 1440 + 1440) % 1440
  const hours = String(Math.floor(shifted / 60)).padStart(2, '0')
  const minutes = String(shifted % 60).padStart(2, '0')

  return `${hours}:${minutes}`
}

export function cloneShiftOrder(order: ShiftOrder, newOrderNumber: number, deltaMinutes: number): ShiftOrder {
  return createShiftOrder(
    newOrderNumber,
    order.nodes.map((node) => {
      if (node.kind === 'time') {
        return createTimeNode(shiftClockValue(node.time, deltaMinutes), Boolean(node.allowBackwardTime))
      }

      return {
        ...createJourneyNode([...node.journeyIds]),
        loopUntil: shiftClockValue(node.loopUntil, deltaMinutes),
      }
    }),
  )
}

function validateJourneyRow(row: JourneyOrderRow, errors: string[], journeyKey: string) {
  if (!row.type.trim()) {
    errors.push(`Journey ${journeyKey} contains an order row without a type.`)
  }

  if (row.type === 'panel' && row.args.length < 1) {
    errors.push(`Journey ${journeyKey} has a panel row without a panel id.`)
  }

  if (row.type === 'stop' && row.args.length < 2) {
    errors.push(`Journey ${journeyKey} has a stop row without a stop name and platform.`)
  }

  if (row.type === 'announcement' && row.args.length < 2) {
    errors.push(`Journey ${journeyKey} has an announcement row without a trigger type and announce string.`)
  }

  if (row.type === 'announcement') {
    const announcementType = row.args[0]?.value?.trim() ?? ''
    if (announcementType && !['new', 'arrive', 'depart'].includes(announcementType)) {
      errors.push(`Journey ${journeyKey} contains an announcement row with an unsupported trigger type: ${announcementType}.`)
    }
  }

  for (const argument of row.args) {
    if (argument.kind === 'number' && Number.isNaN(Number(argument.value))) {
      errors.push(`Journey ${journeyKey} contains an invalid numeric value: ${argument.value}.`)
    }
  }
}

export function validateDocument(document: ShiftDocument): DocumentValidationResult {
  const errors: string[] = []
  const journeyIds = new Set<string>()
  const seenKeys = new Set<string>()

  if (document.journeys.length === 0) {
    errors.push('At least one journey block is required.')
  }

  for (const journey of document.journeys) {
    journeyIds.add(journey.id)
    const normalizedLineDisplay = inferLineDisplayValue(journey.lineDisplay.value)

    if (!IDENTIFIER_PATTERN.test(journey.key.trim())) {
      errors.push(`Journey key ${journey.key || '(empty)'} is not a valid Luau identifier.`)
    }

    if (seenKeys.has(journey.key)) {
      errors.push(`Journey key ${journey.key} is duplicated.`)
    }

    seenKeys.add(journey.key)

    if (normalizedLineDisplay.kind === 'number' && Number.isNaN(Number(normalizedLineDisplay.value))) {
      errors.push(`Journey ${journey.key} contains an invalid line display number.`)
    }

    if (journey.pauseBeforeJourney && Number.isNaN(Number(journey.pauseBeforeJourney))) {
      errors.push(`Journey ${journey.key} contains an invalid pause before journey.`)
    }

    if (journey.pauseAfterJourney && Number.isNaN(Number(journey.pauseAfterJourney))) {
      errors.push(`Journey ${journey.key} contains an invalid pause after journey.`)
    }

    for (const row of journey.orders) {
      validateJourneyRow(row, errors, journey.key)
    }
  }

  if (document.shiftOrders.length === 0) {
    errors.push('At least one shift order is required.')
  }

  const seenOrderNumbers = new Set<number>()
  for (const order of document.shiftOrders) {
    if (!Number.isInteger(order.orderNumber) || order.orderNumber <= 0) {
      errors.push(`Shift order ${order.orderNumber} must be a positive integer.`)
    }

    if (seenOrderNumbers.has(order.orderNumber)) {
      errors.push(`Shift order ${order.orderNumber} is duplicated.`)
    }

    seenOrderNumbers.add(order.orderNumber)

    if (order.nodes.length === 0) {
      errors.push(`Shift order ${order.orderNumber} must contain at least one node.`)
    }

    for (const node of order.nodes) {
      if (node.kind === 'time') {
        if (!TIME_PATTERN.test(node.time)) {
          errors.push(`Shift order ${order.orderNumber} contains an invalid time: ${node.time}.`)
        }
        continue
      }

      if (node.loopUntil && !TIME_PATTERN.test(node.loopUntil)) {
        errors.push(`Shift order ${order.orderNumber} contains an invalid loopUntil time: ${node.loopUntil}.`)
      }

      if (node.journeyIds.length === 0) {
        errors.push(`Shift order ${order.orderNumber} contains a journey node without any journeys.`)
      }

      for (const journeyId of node.journeyIds) {
        if (!journeyIds.has(journeyId)) {
          errors.push(`Shift order ${order.orderNumber} references a missing journey block.`)
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}