import { parse, type Chunk, type Expression, type LocalStatement, type TableConstructorExpression, type TableKey, type TableKeyString } from 'luaparse'

import { createId } from './document'
import { decodeLuaString } from './luaString'

export type TemporaryColorMode = 'none' | 'rgb' | 'auto'
export type TemporaryPanelNumValueMode = 'empty' | 'text' | 'false'
export type TemporaryPanelNumsMode = 'omit' | 'frames' | 'false'

export interface TemporaryColorValue {
  mode: TemporaryColorMode
  hex: string
}

export interface TemporaryPanelNumValue {
  mode: TemporaryPanelNumValueMode
  value: string
}

export interface TemporaryPanelFrame {
  id: string
  head: string
  foot: string
  num: TemporaryPanelNumValue
  headColor: TemporaryColorValue
  headBgColor: TemporaryColorValue
  footColor: TemporaryColorValue
  footBgColor: TemporaryColorValue
  numColor: TemporaryColorValue
  numBgColor: TemporaryColorValue
}

export interface TemporaryNumDisplayFrame {
  id: string
  num: TemporaryPanelNumValue
  numColor: TemporaryColorValue
  numBgColor: TemporaryColorValue
}

export interface TemporaryPanelVariant {
  frontFrames: TemporaryPanelFrame[]
  sideFrames: TemporaryPanelFrame[]
  numsFrames: TemporaryNumDisplayFrame[]
  numsMode: TemporaryPanelNumsMode
}

export interface TemporaryPanelEntry {
  id: string
  panelId: string
  destination: string
  via: string
  color: TemporaryPanelVariant
  mono: TemporaryPanelVariant
}

export interface TemporaryNumVariant {
  num: string
  numColor: TemporaryColorValue
  numBgColor: TemporaryColorValue
}

export interface TemporaryNumEntry {
  id: string
  numId: string
  color: TemporaryNumVariant
  mono: TemporaryNumVariant
}

export interface TemporaryDisplayUpdateState {
  panelEntries: TemporaryPanelEntry[]
  numEntries: TemporaryNumEntry[]
}

function createTemporaryColorValue(mode: TemporaryColorMode = 'none', hex = '#ffffff'): TemporaryColorValue {
  return {
    mode,
    hex,
  }
}

function createTemporaryPanelNumValue(mode: TemporaryPanelNumValueMode = 'empty', value = ''): TemporaryPanelNumValue {
  return {
    mode,
    value,
  }
}

export function createTemporaryPanelFrame(): TemporaryPanelFrame {
  return {
    id: createId('temp-panel-frame'),
    head: '',
    foot: '',
    num: createTemporaryPanelNumValue(),
    headColor: createTemporaryColorValue(),
    headBgColor: createTemporaryColorValue(),
    footColor: createTemporaryColorValue(),
    footBgColor: createTemporaryColorValue(),
    numColor: createTemporaryColorValue(),
    numBgColor: createTemporaryColorValue(),
  }
}

export function createTemporaryNumDisplayFrame(): TemporaryNumDisplayFrame {
  return {
    id: createId('temp-panel-num-frame'),
    num: createTemporaryPanelNumValue('text', ''),
    numColor: createTemporaryColorValue(),
    numBgColor: createTemporaryColorValue(),
  }
}

export function createTemporaryPanelVariant(): TemporaryPanelVariant {
  return {
    frontFrames: [createTemporaryPanelFrame()],
    sideFrames: [],
    numsFrames: [],
    numsMode: 'omit',
  }
}

export function createTemporaryPanelEntry(): TemporaryPanelEntry {
  return {
    id: createId('temp-panel-entry'),
    panelId: '',
    destination: '',
    via: '',
    color: createTemporaryPanelVariant(),
    mono: createTemporaryPanelVariant(),
  }
}

export function createTemporaryNumVariant(): TemporaryNumVariant {
  return {
    num: '',
    numColor: createTemporaryColorValue(),
    numBgColor: createTemporaryColorValue(),
  }
}

export function createTemporaryNumEntry(): TemporaryNumEntry {
  return {
    id: createId('temp-num-entry'),
    numId: '',
    color: createTemporaryNumVariant(),
    mono: createTemporaryNumVariant(),
  }
}

function cloneTemporaryColorValue(value: TemporaryColorValue): TemporaryColorValue {
  return {
    mode: value.mode,
    hex: value.hex,
  }
}

function cloneTemporaryPanelNumValue(value: TemporaryPanelNumValue): TemporaryPanelNumValue {
  return {
    mode: value.mode,
    value: value.value,
  }
}

export function cloneTemporaryPanelFrame(frame: TemporaryPanelFrame): TemporaryPanelFrame {
  return {
    id: createId('temp-panel-frame'),
    head: frame.head,
    foot: frame.foot,
    num: cloneTemporaryPanelNumValue(frame.num),
    headColor: cloneTemporaryColorValue(frame.headColor),
    headBgColor: cloneTemporaryColorValue(frame.headBgColor),
    footColor: cloneTemporaryColorValue(frame.footColor),
    footBgColor: cloneTemporaryColorValue(frame.footBgColor),
    numColor: cloneTemporaryColorValue(frame.numColor),
    numBgColor: cloneTemporaryColorValue(frame.numBgColor),
  }
}

export function cloneTemporaryNumDisplayFrame(frame: TemporaryNumDisplayFrame): TemporaryNumDisplayFrame {
  return {
    id: createId('temp-panel-num-frame'),
    num: cloneTemporaryPanelNumValue(frame.num),
    numColor: cloneTemporaryColorValue(frame.numColor),
    numBgColor: cloneTemporaryColorValue(frame.numBgColor),
  }
}

export function cloneTemporaryPanelVariant(variant: TemporaryPanelVariant): TemporaryPanelVariant {
  return {
    frontFrames: variant.frontFrames.map(cloneTemporaryPanelFrame),
    sideFrames: variant.sideFrames.map(cloneTemporaryPanelFrame),
    numsFrames: variant.numsFrames.map(cloneTemporaryNumDisplayFrame),
    numsMode: variant.numsMode,
  }
}

export function cloneTemporaryNumVariant(variant: TemporaryNumVariant): TemporaryNumVariant {
  return {
    num: variant.num,
    numColor: cloneTemporaryColorValue(variant.numColor),
    numBgColor: cloneTemporaryColorValue(variant.numBgColor),
  }
}

export function cloneTemporaryPanelEntry(entry: TemporaryPanelEntry, entryId = createId('temp-panel-entry')): TemporaryPanelEntry {
  return {
    id: entryId,
    panelId: entry.panelId,
    destination: entry.destination,
    via: entry.via,
    color: cloneTemporaryPanelVariant(entry.color),
    mono: cloneTemporaryPanelVariant(entry.mono),
  }
}

export function cloneTemporaryNumEntry(entry: TemporaryNumEntry, entryId = createId('temp-num-entry')): TemporaryNumEntry {
  return {
    id: entryId,
    numId: entry.numId,
    color: cloneTemporaryNumVariant(entry.color),
    mono: cloneTemporaryNumVariant(entry.mono),
  }
}

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

  if (expression.type === 'UnaryExpression' && expression.operator === '-' && expression.argument.type === 'NumericLiteral') {
    return -expression.argument.value
  }

  throw new Error(`Unsupported numeric expression: ${expression.type}`)
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

function findNamedTable(chunk: Chunk, variableName: string) {
  for (const statement of chunk.body) {
    if (statement.type !== 'LocalStatement') {
      continue
    }

    const localStatement = statement as LocalStatement
    for (let index = 0; index < localStatement.variables.length; index += 1) {
      const variable = localStatement.variables[index]
      const initializer = localStatement.init[index]

      if (variable?.name !== variableName || !initializer) {
        continue
      }

      return expectTable(initializer, `${variableName} must be a table.`)
    }
  }

  throw new Error(`Could not find local ${variableName} table in the supplied Luau source.`)
}

function parseScalarText(expression: Expression) {
  if (expression.type === 'StringLiteral') {
    return decodeLuaString(expression.raw)
  }

  return String(parseNumberExpression(expression))
}

function parseOptionalScalarText(expression: Expression | undefined) {
  if (!expression || expression.type === 'NilLiteral') {
    return ''
  }

  return parseScalarText(expression)
}

function toHexComponent(value: number) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${toHexComponent(r)}${toHexComponent(g)}${toHexComponent(b)}`
}

function parseColorValueFromExpression(expression: Expression | undefined) {
  if (!expression || expression.type === 'NilLiteral') {
    return createTemporaryColorValue()
  }

  if (expression.type === 'StringLiteral') {
    const decoded = decodeLuaString(expression.raw)
    if (decoded === 'auto') {
      return createTemporaryColorValue('auto')
    }

    throw new Error(`Unsupported colour string: ${decoded}`)
  }

  if (expression.type !== 'CallExpression' || expression.base.type !== 'MemberExpression') {
    throw new Error(`Unsupported Color3 expression: ${expression.type}`)
  }

  const member = expression.base
  if (member.indexer !== '.' || member.base.type !== 'Identifier' || member.base.name !== 'Color3') {
    throw new Error('Unsupported color base expression.')
  }

  const components = expression.arguments.map((argument) => parseNumberExpression(argument))
  if (components.length !== 3) {
    throw new Error('Color3 calls must contain exactly three numeric arguments.')
  }

  if (member.identifier.name === 'new') {
    return createTemporaryColorValue('rgb', rgbToHex(components[0]! * 255, components[1]! * 255, components[2]! * 255))
  }

  if (member.identifier.name === 'fromRGB') {
    return createTemporaryColorValue('rgb', rgbToHex(components[0]!, components[1]!, components[2]!))
  }

  throw new Error(`Unsupported Color3 factory: ${member.identifier.name}`)
}

function parsePanelNumValueFromExpression(expression: Expression | undefined) {
  if (!expression || expression.type === 'NilLiteral') {
    return createTemporaryPanelNumValue()
  }

  if (expression.type === 'BooleanLiteral' && expression.value === false) {
    return createTemporaryPanelNumValue('false')
  }

  return createTemporaryPanelNumValue('text', parseScalarText(expression))
}

function parseArrayValues(expression: Expression, message: string) {
  return expectTable(expression, message).fields.map((field) => {
    if (field.type !== 'TableValue') {
      throw new Error(message)
    }

    return field.value
  })
}

function parseOptionalArrayValues(expression: Expression | undefined, message: string) {
  if (!expression || expression.type === 'NilLiteral') {
    return []
  }

  if (expression.type === 'BooleanLiteral' && expression.value === false) {
    return []
  }

  return parseArrayValues(expression, message)
}

function parsePanelFrameFromExpression(expression: Expression) {
  const frame = createTemporaryPanelFrame()
  const fields = getTableFieldMap(expectTable(expression, 'Panel frames must be tables.'))

  return {
    ...frame,
    head: parseOptionalScalarText(fields.get('Head')),
    foot: parseOptionalScalarText(fields.get('Foot')),
    num: parsePanelNumValueFromExpression(fields.get('Num')),
    headColor: parseColorValueFromExpression(fields.get('HeadColor')),
    headBgColor: parseColorValueFromExpression(fields.get('HeadBgColor')),
    footColor: parseColorValueFromExpression(fields.get('FootColor')),
    footBgColor: parseColorValueFromExpression(fields.get('FootBgColor')),
    numColor: parseColorValueFromExpression(fields.get('NumColor')),
    numBgColor: parseColorValueFromExpression(fields.get('NumBgColor')),
  }
}

function parseNumDisplayFrameFromExpression(expression: Expression) {
  const frame = createTemporaryNumDisplayFrame()
  const fields = getTableFieldMap(expectTable(expression, 'Num display frames must be tables.'))

  return {
    ...frame,
    num: parsePanelNumValueFromExpression(fields.get('Num')),
    numColor: parseColorValueFromExpression(fields.get('NumColor')),
    numBgColor: parseColorValueFromExpression(fields.get('NumBgColor')),
  }
}

function parsePanelVariantFromDisplayFrames(expression: Expression) {
  const displayFrames = getTableFieldMap(expectTable(expression, 'DisplayFrames must be a table.'))
  const frontExpression = displayFrames.get('Front')

  if (!frontExpression) {
    throw new Error('Panel definitions must include a DisplayFrames.Front block.')
  }

  const frontFrames = parseArrayValues(frontExpression, 'Front frames must use array-style values.').map(parsePanelFrameFromExpression)
  if (frontFrames.length === 0) {
    throw new Error('Panel definitions must include at least one front frame.')
  }

  const sideExpression = displayFrames.get('Side')
  const numsExpression = displayFrames.get('Nums')

  return {
    frontFrames,
    sideFrames: parseOptionalArrayValues(sideExpression, 'Side frames must use array-style values.').map(parsePanelFrameFromExpression),
    numsFrames: numsExpression && !(numsExpression.type === 'BooleanLiteral' && numsExpression.value === false)
      ? parseArrayValues(numsExpression, 'Nums frames must use array-style values.').map(parseNumDisplayFrameFromExpression)
      : [],
    numsMode: !numsExpression || numsExpression.type === 'NilLiteral'
      ? 'omit'
      : numsExpression.type === 'BooleanLiteral' && numsExpression.value === false
        ? 'false'
        : 'frames',
  } satisfies TemporaryPanelVariant
}

function parseNumVariantFromLineDisplay(expression: Expression) {
  const fields = getTableFieldMap(expectTable(expression, 'LineDisplay must be a table.'))

  return {
    num: parseOptionalScalarText(fields.get('Num')),
    numColor: parseColorValueFromExpression(fields.get('NumColor')),
    numBgColor: parseColorValueFromExpression(fields.get('NumBgColor')),
  } satisfies TemporaryNumVariant
}

export function parseTemporaryPanelsModuleSource(source: string) {
  const chunk = parseChunk(source)
  const panelsTable = findNamedTable(chunk, 'Panels')

  return panelsTable.fields.flatMap((field) => {
    if (field.type !== 'TableKey') {
      return []
    }

    const panelId = String(parseNumberExpression(field.key))
    const panelFields = getTableFieldMap(expectTable(field.value, 'Panel definitions must be tables.'))
    const parsedVariant = parsePanelVariantFromDisplayFrames(panelFields.get('DisplayFrames') ?? expectTable(field.value, 'Panel definitions must be tables.'))
    const entry = createTemporaryPanelEntry()

    return [{
      ...entry,
      panelId,
      destination: parseOptionalScalarText(panelFields.get('Destination')),
      via: parseOptionalScalarText(panelFields.get('via')),
      color: cloneTemporaryPanelVariant(parsedVariant),
      mono: cloneTemporaryPanelVariant(parsedVariant),
    } satisfies TemporaryPanelEntry]
  })
}

export function parseTemporaryNumsModuleSource(source: string) {
  const chunk = parseChunk(source)
  const numsTable = findNamedTable(chunk, 'Nums')

  return numsTable.fields.flatMap((field) => {
    if (field.type !== 'TableKey') {
      return []
    }

    const numId = String(parseNumberExpression(field.key))
    const numFields = getTableFieldMap(expectTable(field.value, 'Num definitions must be tables.'))
    const parsedVariant = parseNumVariantFromLineDisplay(numFields.get('LineDisplay') ?? expectTable(field.value, 'Num definitions must be tables.'))
    const entry = createTemporaryNumEntry()

    return [{
      ...entry,
      numId,
      color: cloneTemporaryNumVariant(parsedVariant),
      mono: cloneTemporaryNumVariant(parsedVariant),
    } satisfies TemporaryNumEntry]
  })
}

function requireIntegerId(value: string, label: string) {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`${label} is required.`)
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${label} must be a positive integer.`)
  }

  return normalized
}

function requireUniqueIds(values: string[], label: string) {
  const seenValues = new Set<string>()

  for (const value of values) {
    if (seenValues.has(value)) {
      throw new Error(`${label} ${value} is duplicated.`)
    }

    seenValues.add(value)
  }
}

function parseHexColor(hex: string) {
  const normalized = hex.trim()
  const match = /^#([0-9a-fA-F]{6})$/.exec(normalized)
  if (!match) {
    throw new Error(`Invalid colour value: ${hex || '(empty)'}.`)
  }

  return {
    r: Number.parseInt(match[1]!.slice(0, 2), 16),
    g: Number.parseInt(match[1]!.slice(2, 4), 16),
    b: Number.parseInt(match[1]!.slice(4, 6), 16),
  }
}

function serializeColorValue(color: TemporaryColorValue, allowAuto = false) {
  if (color.mode === 'none') {
    return 'nil'
  }

  if (color.mode === 'auto') {
    if (!allowAuto) {
      throw new Error('Auto colour is only supported for num colours.')
    }

    return '"auto"'
  }

  const rgb = parseHexColor(color.hex)
  return `Color3.fromRGB(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

function serializeOptionalString(value: string) {
  return value.trim() ? JSON.stringify(value) : 'nil'
}

function serializePanelNumValue(value: TemporaryPanelNumValue) {
  if (value.mode === 'false') {
    return 'false'
  }

  if (value.mode === 'text' && value.value.trim()) {
    return JSON.stringify(value.value)
  }

  return 'nil'
}

function serializePanelFrame(frame: TemporaryPanelFrame, indent: string, allowAutoColors = false) {
  return [
    `${indent}{`,
    `${indent}\tHead = ${serializeOptionalString(frame.head)}, HeadColor = ${serializeColorValue(frame.headColor, allowAutoColors)}, HeadBgColor = ${serializeColorValue(frame.headBgColor, allowAutoColors)},`,
    `${indent}\tFoot = ${serializeOptionalString(frame.foot)}, FootColor = ${serializeColorValue(frame.footColor, allowAutoColors)}, FootBgColor = ${serializeColorValue(frame.footBgColor, allowAutoColors)},`,
    `${indent}\tNum = ${serializePanelNumValue(frame.num)}, NumColor = ${serializeColorValue(frame.numColor, allowAutoColors || true)}, NumBgColor = ${serializeColorValue(frame.numBgColor, allowAutoColors)},`,
    `${indent}},`,
  ].join('\n')
}

function serializeNumDisplayFrame(frame: TemporaryNumDisplayFrame, indent: string, allowAutoColors = false) {
  return [
    `${indent}{`,
    `${indent}\tNum = ${serializePanelNumValue(frame.num)}, NumColor = ${serializeColorValue(frame.numColor, true)}, NumBgColor = ${serializeColorValue(frame.numBgColor, allowAutoColors)},`,
    `${indent}},`,
  ].join('\n')
}

function serializeFrameBlock(name: string, frames: string[], indent: string) {
  return [
    `${indent}${name} = {`,
    ...frames,
    `${indent}},`,
  ].join('\n')
}

function serializePanelVariant(variant: TemporaryPanelVariant, allowAutoColors = false) {
  if (variant.frontFrames.length === 0) {
    throw new Error('Each panel variant must contain at least one front frame.')
  }

  const blocks = [
    serializeFrameBlock('Front', variant.frontFrames.map((frame) => serializePanelFrame(frame, '\t\t\t', allowAutoColors)), '\t\t'),
  ]

  if (variant.sideFrames.length > 0) {
    blocks.push(serializeFrameBlock('Side', variant.sideFrames.map((frame) => serializePanelFrame(frame, '\t\t\t', allowAutoColors)), '\t\t'))
  }

  if (variant.numsMode === 'false') {
    blocks.push('\t\tNums = false,')
  } else if (variant.numsMode === 'frames') {
    if (variant.numsFrames.length === 0) {
      throw new Error('Nums display frames mode requires at least one frame.')
    }

    blocks.push(serializeFrameBlock('Nums', variant.numsFrames.map((frame) => serializeNumDisplayFrame(frame, '\t\t\t', allowAutoColors)), '\t\t'))
  }

  return [
    '\tDisplayFrames = {',
    ...blocks,
    '\t}',
  ].join('\n')
}

function serializePanelEntry(entry: TemporaryPanelEntry, variant: TemporaryPanelVariant, allowAutoColors = false) {
  const panelId = requireIntegerId(entry.panelId, 'Panel ID')

  return [
    `Panels[${panelId}] = {`,
    `\tDestination = ${serializeOptionalString(entry.destination)}, via = ${serializeOptionalString(entry.via)},`,
    serializePanelVariant(variant, allowAutoColors),
    '}',
  ].join('\n')
}

function serializeNumVariant(variant: TemporaryNumVariant, allowAutoColors = false) {
  if (!variant.num.trim()) {
    throw new Error('Each num variant must define a Num value.')
  }

  return [
    '\tLineDisplay = {',
    `\t\tNum = ${JSON.stringify(variant.num)}, NumColor = ${serializeColorValue(variant.numColor, true)}, NumBgColor = ${serializeColorValue(variant.numBgColor, allowAutoColors)},`,
    '\t},',
  ].join('\n')
}

function serializeNumEntry(entry: TemporaryNumEntry, variant: TemporaryNumVariant, allowAutoColors = false) {
  const numId = requireIntegerId(entry.numId, 'Num ID')

  return [
    `Nums[${numId}] = {`,
    serializeNumVariant(variant, allowAutoColors),
    '}',
  ].join('\n')
}

function buildPanelVariantBlock(variantName: 'Color' | 'Mono', panelEntries: TemporaryPanelEntry[]) {
  if (panelEntries.length === 0) {
    return ''
  }

  const allowAutoColors = variantName === 'Mono'
  const serializedEntries = panelEntries.map((entry) => serializePanelEntry(entry, entry[variantName.toLowerCase() as 'color' | 'mono'], allowAutoColors))

  return [
    `local Panels = require(BUSEV3.Panels:WaitForChild(${JSON.stringify(variantName)}))`,
    ...serializedEntries,
  ].join('\n\n')
}

function buildNumVariantBlock(variantName: 'Color' | 'Mono', numEntries: TemporaryNumEntry[]) {
  if (numEntries.length === 0) {
    return ''
  }

  const allowAutoColors = variantName === 'Mono'
  const serializedEntries = numEntries.map((entry) => serializeNumEntry(entry, entry[variantName.toLowerCase() as 'color' | 'mono'], allowAutoColors))

  return [
    `local Nums = require(BUSEV3.Nums:WaitForChild(${JSON.stringify(variantName)}))`,
    ...serializedEntries,
  ].join('\n\n')
}

export function generateTemporaryDisplayUpdateSource(state: TemporaryDisplayUpdateState) {
  if (state.panelEntries.length === 0 && state.numEntries.length === 0) {
    throw new Error('Add at least one temporary panel or num entry before generating live update code.')
  }

  const panelIds = state.panelEntries.map((entry) => requireIntegerId(entry.panelId, 'Panel ID'))
  const numIds = state.numEntries.map((entry) => requireIntegerId(entry.numId, 'Num ID'))
  requireUniqueIds(panelIds, 'Panel ID')
  requireUniqueIds(numIds, 'Num ID')

  const blocks = [
    'local BUSEV3 = game:GetService("ReplicatedStorage"):WaitForChild("BUSEV3")',
  ]

  const panelColorBlock = buildPanelVariantBlock('Color', state.panelEntries)
  const panelMonoBlock = buildPanelVariantBlock('Mono', state.panelEntries)
  const numColorBlock = buildNumVariantBlock('Color', state.numEntries)
  const numMonoBlock = buildNumVariantBlock('Mono', state.numEntries)

  for (const block of [panelColorBlock, panelMonoBlock, numColorBlock, numMonoBlock]) {
    if (block) {
      blocks.push(block)
    }
  }

  return blocks.join('\n\n')
}