import { parse, type AssignmentStatement, type Chunk, type Expression, type LocalStatement, type TableConstructorExpression, type TableKey, type TableKeyString } from 'luaparse'

import {
  createJourney,
  createJourneyArgument,
  createJourneyNode,
  createJourneyOrderRow,
  createShiftOrder,
  createTimeNode,
  inferLineDisplayValue,
  validateDocument,
} from './document'
import { decodeLuaString } from './luaString'
import type { JourneyDefinition, JourneyOrderArgument, NullableScalarValue, ScalarValue, ShiftDocument, ShiftOrder, ShiftPlanNode } from '../types'

const JOURNEY_FIELD_NAMES = new Set(['LineDisplay', 'From', 'To', 'PauseBeforeJourney', 'PauseAfterJourney', 'PauseBeforeDeparture', 'Orders'])

function parseChunk(source: string) {
  return parse(source, {
    comments: false,
    encodingMode: 'none',
    luaVersion: '5.3',
  }) as Chunk
}

function readStringLiteral(expression: Expression, message: string) {
  if (expression.type !== 'StringLiteral') {
    throw new Error(message)
  }

  return decodeLuaString(expression.raw)
}

function getFieldName(field: TableKeyString | TableKey) {
  if (field.type === 'TableKeyString') {
    return field.key.name
  }

  if (field.key.type === 'Identifier') {
    return field.key.name
  }

  if (field.key.type === 'StringLiteral') {
    return decodeLuaString(field.key.raw)
  }

  return null
}

function isJourneyTable(expression: TableConstructorExpression) {
  return expression.fields.some((field) => {
    if (field.type !== 'TableKeyString' && field.type !== 'TableKey') {
      return false
    }

    const fieldName = getFieldName(field)
    return fieldName ? JOURNEY_FIELD_NAMES.has(fieldName) : false
  })
}

function expectTable(expression: Expression, message: string) {
  if (expression.type !== 'TableConstructorExpression') {
    throw new Error(message)
  }

  return expression
}

function expectIdentifier(expression: Expression, message: string) {
  if (expression.type !== 'Identifier') {
    throw new Error(message)
  }

  return expression
}

function parseNumberExpression(expression: Expression) {
  if (expression.type === 'NumericLiteral') {
    return expression.value
  }

  if (
    expression.type === 'UnaryExpression' &&
    expression.operator === '-' &&
    expression.argument.type === 'NumericLiteral'
  ) {
    return -expression.argument.value
  }

  throw new Error(`Unsupported numeric expression: ${expression.type}`)
}

function parseScalar(expression: Expression): ScalarValue {
  if (expression.type === 'StringLiteral') {
    return { kind: 'string', value: decodeLuaString(expression.raw) }
  }

  return { kind: 'number', value: String(parseNumberExpression(expression)) }
}

function parseNullableScalar(expression: Expression): NullableScalarValue {
  if (expression.type === 'NilLiteral') {
    return { kind: 'nil', value: '' }
  }

  return parseScalar(expression)
}

function getTableFieldMap(expression: TableConstructorExpression) {
  const map = new Map<string, Expression>()

  for (const field of expression.fields) {
    if (field.type !== 'TableKeyString' && field.type !== 'TableKey') {
      continue
    }

    const fieldName = getFieldName(field)
    if (!fieldName) {
      continue
    }

    map.set(fieldName, field.value)
  }

  return map
}

function parseOrderArgument(expression: Expression): JourneyOrderArgument {
  const value = parseScalar(expression)
  return createJourneyArgument(value.kind, value.value)
}

function parseOrderRow(expression: Expression) {
  const rowTable = expectTable(expression, 'Route order rows must be table expressions.')
  const values = rowTable.fields.map((field) => {
    if (field.type !== 'TableValue') {
      throw new Error('Route order rows only support array-style values.')
    }

    return field.value
  })

  if (values.length === 0) {
    throw new Error('Route order rows cannot be empty.')
  }

  const [typeExpression, ...args] = values
  const rowType = parseScalar(typeExpression)
  if (rowType.kind !== 'string') {
    throw new Error('Route order row types must be strings.')
  }

  return createJourneyOrderRow(
    rowType.value,
    args.map((argument) => parseOrderArgument(argument)),
  )
}

function parseJourneyOrders(expression: Expression) {
  const ordersTable = expectTable(expression, 'Journey orders must be table expressions.')

  return ordersTable.fields.map((field) => {
    if (field.type !== 'TableValue') {
      throw new Error('Journey orders only support array-style rows.')
    }

    return parseOrderRow(field.value)
  })
}

function parseJourneyDefinition(name: string, expression: TableConstructorExpression): JourneyDefinition {
  const fields = getTableFieldMap(expression)
  const fromValue = fields.get('From')
  const toValue = fields.get('To')
  const pauseBeforeJourneyValue = fields.get('PauseBeforeJourney') ?? fields.get('PauseBeforeDeparture')
  const pauseAfterJourneyValue = fields.get('PauseAfterJourney')

  return createJourney({
    key: name,
    lineDisplay: fields.has('LineDisplay')
      ? parseNullableScalar(fields.get('LineDisplay')!)
      : { kind: 'nil', value: '' },
    from: fromValue?.type === 'StringLiteral' ? decodeLuaString(fromValue.raw) : '',
    to: toValue?.type === 'StringLiteral' ? decodeLuaString(toValue.raw) : '',
    pauseBeforeJourney: pauseBeforeJourneyValue
      ? String(parseNumberExpression(pauseBeforeJourneyValue))
      : '',
    pauseAfterJourney: pauseAfterJourneyValue
      ? String(parseNumberExpression(pauseAfterJourneyValue))
      : '',
    orders: fields.has('Orders') ? parseJourneyOrders(fields.get('Orders')!) : [],
  })
}

function parseJourneyReferences(expression: Expression, journeyIdByKey: Map<string, string>) {
  const journeyTable = expectTable(expression, 'Journey node references must be a table expression.')

  return journeyTable.fields.map((field) => {
    if (field.type !== 'TableValue') {
      throw new Error('Journey references only support array-style values.')
    }

    const identifier = expectIdentifier(field.value, 'Journey references must be local identifiers.')
    const journeyId = journeyIdByKey.get(identifier.name)

    if (!journeyId) {
      throw new Error(`Unknown journey reference: ${identifier.name}`)
    }

    return journeyId
  })
}

function parsePlanNode(expression: Expression, journeyIdByKey: Map<string, string>): ShiftPlanNode {
  const nodeTable = expectTable(expression, 'Shift nodes must be table expressions.')
  const fields = getTableFieldMap(nodeTable)

  if (fields.has('time')) {
    const timeValue = fields.get('time')
    if (!timeValue || timeValue.type !== 'StringLiteral') {
      throw new Error('Time nodes must contain a string time value.')
    }

    return createTimeNode(readStringLiteral(timeValue, 'Time nodes must contain a string time value.'))
  }

  if (fields.has('journeys')) {
    const loopUntilValue = fields.get('loopUntil')
    const node = createJourneyNode(parseJourneyReferences(fields.get('journeys')!, journeyIdByKey))

    if (loopUntilValue) {
      if (loopUntilValue.type !== 'StringLiteral') {
        throw new Error('loopUntil must be a string value.')
      }

      node.loopUntil = decodeLuaString(loopUntilValue.raw)
    }

    return node
  }

  throw new Error('Unsupported shift plan node: expected time or journeys.')
}

function parseShiftOrderNode(field: TableKey, journeyIdByKey: Map<string, string>) {
  const orderNumber = parseNumberExpression(field.key)
  if (!Number.isInteger(orderNumber)) {
    throw new Error(`Shift order numbers must be integers. Received ${orderNumber}.`)
  }

  const orderTable = expectTable(field.value, 'Shift order values must be table expressions.')
  const nodes = orderTable.fields.map((orderField) => {
    if (orderField.type !== 'TableValue') {
      throw new Error('Shift orders only support array-style nodes.')
    }

    return parsePlanNode(orderField.value, journeyIdByKey)
  })

  return createShiftOrder(orderNumber, nodes)
}

function isShiftPlanAssignment(statement: AssignmentStatement) {
  if (statement.variables.length !== 1 || statement.init.length !== 1) {
    return false
  }

  const target = statement.variables[0]
  if (target.type !== 'MemberExpression') {
    return false
  }

  return (
    target.indexer === '.' &&
    target.base.type === 'Identifier' &&
    target.base.name === 'SHIFT' &&
    target.identifier.name === '_plan'
  )
}

function serializeScalarValue(value: ScalarValue | NullableScalarValue) {
  if (value.kind === 'nil' || !value.value.trim()) {
    return 'nil'
  }

  if (value.kind === 'number') {
    return String(Number(value.value))
  }

  return JSON.stringify(value.value)
}

function serializeOrderArgument(argument: JourneyOrderArgument) {
  if (argument.kind === 'number') {
    return String(Number(argument.value))
  }

  return JSON.stringify(argument.value)
}

function serializeJourney(journey: JourneyDefinition) {
  const lineDisplay = inferLineDisplayValue(journey.lineDisplay.value)
  const lines = [
    `local ${journey.key} = {`,
    `\tLineDisplay = ${serializeScalarValue(lineDisplay)}, From = ${journey.from ? JSON.stringify(journey.from) : 'nil'}, To = ${journey.to ? JSON.stringify(journey.to) : 'nil'},`,
  ]

  if (journey.pauseBeforeJourney) {
    lines.push('', `\tPauseBeforeJourney = ${String(Number(journey.pauseBeforeJourney))},`)
  }

  if (journey.pauseAfterJourney) {
    lines.push('', `\tPauseAfterJourney = ${String(Number(journey.pauseAfterJourney))},`)
  }

  if (journey.orders.length > 0) {
    lines.push('', '\tOrders = {')

    for (const row of journey.orders) {
      const rowItems = [JSON.stringify(row.type), ...row.args.map((argument) => serializeOrderArgument(argument))]
      lines.push(`\t\t{${rowItems.join(', ')}},`)
    }

    lines.push('\t},')
  }

  lines.push('}')

  return lines.join('\n')
}

function serializePlanNode(node: ShiftPlanNode, journeyKeyById: Map<string, string>) {
  if (node.kind === 'time') {
    return `\t\t{time = ${JSON.stringify(node.time)}},`
  }

  const references = node.journeyIds.map((journeyId) => {
    const key = journeyKeyById.get(journeyId)
    if (!key) {
      throw new Error('Cannot export a shift that references a missing journey block.')
    }

    return key
  })

  const parts = [`journeys = {${references.join(', ')}}`]
  if (node.loopUntil) {
    parts.push(`loopUntil = ${JSON.stringify(node.loopUntil)}`)
  }

  return `\t\t{${parts.join(', ')}},`
}

function serializeShiftOrder(order: ShiftOrder, journeyKeyById: Map<string, string>) {
  const lines = [`\t[${order.orderNumber}] = {`]

  for (const node of order.nodes) {
    lines.push(serializePlanNode(node, journeyKeyById))
  }

  lines.push('\t},')

  return lines.join('\n')
}

export function parseShiftModuleSource(source: string): ShiftDocument {
  const chunk = parseChunk(source)
  const journeys: JourneyDefinition[] = []
  let planTable: TableConstructorExpression | null = null

  for (const statement of chunk.body) {
    if (statement.type === 'LocalStatement') {
      const localStatement = statement as LocalStatement
      for (let index = 0; index < localStatement.variables.length; index += 1) {
        const variable = localStatement.variables[index]
        const initializer = localStatement.init[index]

        if (!initializer || initializer.type !== 'TableConstructorExpression') {
          continue
        }

        if (!isJourneyTable(initializer)) {
          continue
        }

        journeys.push(parseJourneyDefinition(variable.name, initializer))
      }
      continue
    }

    if (statement.type === 'AssignmentStatement' && isShiftPlanAssignment(statement)) {
      const assignment = statement as AssignmentStatement
      planTable = expectTable(assignment.init[0], 'SHIFT._plan must be a table expression.')
    }
  }

  if (!planTable) {
    throw new Error('Could not find SHIFT._plan in the supplied Luau source.')
  }

  const journeyIdByKey = new Map(journeys.map((journey) => [journey.key, journey.id]))
  const shiftOrders = planTable.fields.map((field) => {
    if (field.type !== 'TableKey') {
      throw new Error('SHIFT._plan must use numeric keys such as [1], [2], ...')
    }

    return parseShiftOrderNode(field, journeyIdByKey)
  })

  return {
    journeys,
    shiftOrders,
  }
}

export function generateShiftModuleSource(document: ShiftDocument) {
  const validation = validateDocument(document)
  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'))
  }

  const sortedOrders = [...document.shiftOrders].sort((left, right) => left.orderNumber - right.orderNumber)
  const journeyKeyById = new Map(document.journeys.map((journey) => [journey.id, journey.key]))

  const sections = ['-- Generated by Shiftmaker Web', '']

  for (const journey of document.journeys) {
    sections.push(serializeJourney(journey), '')
  }

  sections.push('local SHIFT = {}', '', 'SHIFT._plan = {')

  for (const order of sortedOrders) {
    sections.push(serializeShiftOrder(order, journeyKeyById))
  }

  sections.push('}', '', 'return SHIFT')

  return sections.join('\n')
}