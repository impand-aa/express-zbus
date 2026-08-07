import { parse, type Chunk, type Expression, type LocalStatement, type TableConstructorExpression, type TableKey, type TableKeyString } from 'luaparse'

import { createJourneyArgument, createJourneyOrderRow, createId, inferLineDisplayValue } from './document'
import { decodeLuaString } from './luaString'
import type {
  DisplayLinePreview,
  ImportedPanelDefinition,
  ImportedRouteDefinition,
  ImportedSoundDefinition,
  JourneyDefinition,
  JourneyOrderRow,
  NullableScalarValue,
  RouteMatchResult,
  RgbColor,
  ScalarValue,
} from '../types'

const DEFAULT_LINE_BACKGROUND = 'rgb(166, 171, 180)'
const DEFAULT_LINE_FOREGROUND = 'rgb(255, 255, 255)'

function normalizeLuauTemplateStrings(source: string) {
  return source.replace(/`([^`\\]*(?:\\.[^`\\]*)*)`/g, (_match, content: string) => JSON.stringify(content))
}

function parseChunk(source: string) {
  return parse(normalizeLuauTemplateStrings(source), {
    comments: false,
    encodingMode: 'none',
    luaVersion: '5.3',
  }) as Chunk
}

function expectTable(expression: Expression, message: string) {
  if (expression.type !== 'TableConstructorExpression') {
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
    args.map((argument) => {
      const value = parseScalar(argument)
      return createJourneyArgument(value.kind, value.value)
    }),
  )
}

function parseOrders(expression: Expression) {
  const ordersTable = expectTable(expression, 'Orders must be table expressions.')

  return ordersTable.fields.map((field) => {
    if (field.type !== 'TableValue') {
      throw new Error('Orders only support array-style rows.')
    }

    return parseOrderRow(field.value)
  })
}

function findNamedTable(chunk: Chunk, variableName: string) {
  for (const statement of chunk.body) {
    if (statement.type !== 'LocalStatement') {
      continue
    }

    const localStatement = statement as LocalStatement
    for (let index = 0; index < localStatement.variables.length; index += 1) {
      const variable = localStatement.variables[index]
      const initializer = localStatement.init[index]

      if (variable.name !== variableName || !initializer) {
        continue
      }

      return expectTable(initializer, `${variableName} must be a table.`)
    }
  }

  throw new Error(`Could not find local ${variableName} table in the supplied Luau source.`)
}

function parseColorExpression(expression: Expression | undefined): RgbColor | null {
  if (!expression || expression.type === 'NilLiteral') {
    return null
  }

  if (expression.type !== 'CallExpression' || expression.base.type !== 'MemberExpression') {
    throw new Error(`Unsupported Color3 expression: ${expression.type}`)
  }

  const member = expression.base
  if (
    member.indexer !== '.' ||
    member.base.type !== 'Identifier' ||
    member.base.name !== 'Color3'
  ) {
    throw new Error('Unsupported color base expression.')
  }

  const components = expression.arguments.map((argument) => parseNumberExpression(argument))
  if (components.length !== 3) {
    throw new Error('Color3 calls must contain exactly three numeric arguments.')
  }

  if (member.identifier.name === 'new') {
    return {
      r: Math.round(components[0]! * 255),
      g: Math.round(components[1]! * 255),
      b: Math.round(components[2]! * 255),
    }
  }

  if (member.identifier.name === 'fromRGB') {
    return {
      r: Math.round(components[0]!),
      g: Math.round(components[1]!),
      b: Math.round(components[2]!),
    }
  }

  throw new Error(`Unsupported Color3 factory: ${member.identifier.name}`)
}

function buildRouteBounds(orders: JourneyOrderRow[]) {
  let firstStopName = ''
  let lastStopName = ''

  for (const row of orders) {
    if (row.type !== 'stop') {
      continue
    }

    const stopName = row.args[0]?.value ?? ''
    if (!firstStopName) {
      firstStopName = stopName
    }
    lastStopName = stopName
  }

  return {
    firstStopName,
    lastStopName,
  }
}

function parseRouteDefinition(expression: TableConstructorExpression, index: number): ImportedRouteDefinition {
  const fields = getTableFieldMap(expression)
  const orders = fields.has('Orders') ? parseOrders(fields.get('Orders')!) : []
  const bounds = buildRouteBounds(orders)

  return {
    id: `route-${index + 1}-${createId('imported')}`,
    lineDisplay: fields.has('LineDisplay')
      ? parseNullableScalar(fields.get('LineDisplay')!)
      : { kind: 'nil', value: '' },
    lineDisplayColor: parseColorExpression(fields.get('LineDisplayColor')),
    lineDisplayBgColor: parseColorExpression(fields.get('LineDisplayBgColor')),
    orders,
    firstStopName: bounds.firstStopName,
    lastStopName: bounds.lastStopName,
  }
}

export function parseRoutesModuleSource(source: string) {
  const chunk = parseChunk(source)
  const routesTable = findNamedTable(chunk, 'Routes')

  return routesTable.fields.map((field, index) => {
    if (field.type !== 'TableValue') {
      throw new Error('Routes table only supports array-style route definitions.')
    }

    return parseRouteDefinition(expectTable(field.value, 'Route definitions must be tables.'), index)
  })
}

export function parsePanelsModuleSource(source: string) {
  const chunk = parseChunk(source)
  const panelsTable = findNamedTable(chunk, 'Panels')

  return panelsTable.fields.flatMap((field) => {
    if (field.type !== 'TableKey') {
      return []
    }

    const panelId = parseNumberExpression(field.key)
    const panelTable = expectTable(field.value, 'Panel definitions must be tables.')
    const panelFields = getTableFieldMap(panelTable)
    const destination = panelFields.get('Destination')

    return [{
      id: panelId,
      destination: destination?.type === 'StringLiteral' ? decodeLuaString(destination.raw) : '',
    } satisfies ImportedPanelDefinition]
  })
}

export function parseSoundsModuleSource(source: string) {
  const chunk = parseChunk(source)
  const soundsTable = findNamedTable(chunk, 'Sounds')

  return soundsTable.fields.flatMap((field) => {
    if (field.type !== 'TableKey') {
      return []
    }

    const soundKey = getFieldName(field)
    if (!soundKey || field.value.type !== 'StringLiteral') {
      return []
    }

    return [{
      key: soundKey,
      assetId: decodeLuaString(field.value.raw),
    } satisfies ImportedSoundDefinition]
  })
}

function sameLineDisplay(journey: JourneyDefinition, route: ImportedRouteDefinition) {
  const normalizedLineDisplay = inferLineDisplayValue(journey.lineDisplay.value)

  if (normalizedLineDisplay.kind === 'nil') {
    return false
  }

  return (
    route.lineDisplay.kind === normalizedLineDisplay.kind &&
    route.lineDisplay.value === normalizedLineDisplay.value
  )
}

function getJourneyExpectationCount(journey: JourneyDefinition) {
  let expectationCount = 0
  const normalizedLineDisplay = inferLineDisplayValue(journey.lineDisplay.value)

  if (normalizedLineDisplay.kind !== 'nil') {
    expectationCount += 1
  }
  if (journey.from) {
    expectationCount += 1
  }
  if (journey.to) {
    expectationCount += 1
  }

  return expectationCount
}

function getRouteFactorCount(journey: JourneyDefinition, route: ImportedRouteDefinition) {
  let factors = 0

  if (sameLineDisplay(journey, route)) {
    factors += 1
  }
  if (journey.from && route.firstStopName === journey.from) {
    factors += 1
  }
  if (journey.to && route.lastStopName === journey.to) {
    factors += 1
  }

  return factors
}

export function findBestRouteMatch(journey: JourneyDefinition, routes: ImportedRouteDefinition[]): RouteMatchResult | null {
  let fallbackRoute: ImportedRouteDefinition | null = null
  let fallbackScore = -1
  const expectationCount = getJourneyExpectationCount(journey)

  for (const route of routes) {
    const factors = getRouteFactorCount(journey, route)

    if (factors >= expectationCount) {
      return {
        route,
        mode: 'source',
      }
    }

    if (factors > fallbackScore) {
      fallbackScore = factors
      fallbackRoute = route
    }
  }

  if (fallbackRoute && fallbackScore > 0) {
    return {
      route: fallbackRoute,
      mode: 'fallback',
    }
  }

  return null
}

export function getPanelDestination(panels: ImportedPanelDefinition[], panelIdValue: string) {
  const panelId = Number(panelIdValue)
  if (Number.isNaN(panelId)) {
    return ''
  }

  return panels.find((panel) => panel.id === panelId)?.destination ?? ''
}

function toCssColor(color: RgbColor) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`
}

function transformLineBackground(color: RgbColor) {
  const average = (color.r + color.g + color.b) / (255 * 3)
  const multiplier = average < 0.49 || average > 0.65 ? 255 : 180

  return {
    r: Math.round((color.r / 255) * multiplier),
    g: Math.round((color.g / 255) * multiplier),
    b: Math.round((color.b / 255) * multiplier),
  } satisfies RgbColor
}

export function getDisplayLinePreview(journey: JourneyDefinition, match: RouteMatchResult | null): DisplayLinePreview | null {
  if (!match) {
    return null
  }

  const normalizedLineDisplay = inferLineDisplayValue(journey.lineDisplay.value)

  const lineText = normalizedLineDisplay.kind !== 'nil'
    ? normalizedLineDisplay.value
    : match.route.lineDisplay.kind !== 'nil'
      ? match.route.lineDisplay.value
      : '/'

  return {
    text: lineText || '/',
    textColor: match.route.lineDisplayColor ? toCssColor(match.route.lineDisplayColor) : DEFAULT_LINE_FOREGROUND,
    backgroundColor: match.route.lineDisplayBgColor
      ? toCssColor(transformLineBackground(match.route.lineDisplayBgColor))
      : DEFAULT_LINE_BACKGROUND,
    isRounded: Boolean(Number(lineText)) && lineText.length === 1,
  }
}

export function getInheritedOrdersPreview(journey: JourneyDefinition, routes: ImportedRouteDefinition[]) {
  if (journey.orders.length > 0) {
    return []
  }

  return findBestRouteMatch(journey, routes)?.route.orders ?? []
}