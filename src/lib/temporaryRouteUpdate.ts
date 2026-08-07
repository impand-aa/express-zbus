import { inferLineDisplayValue, createId } from './document'

import type { TemporaryColorValue } from './temporaryDisplayUpdate'

export interface TemporaryRouteEntry {
  id: string
  lineDisplay: string
  lineDisplayColor: TemporaryColorValue
  lineDisplayBgColor: TemporaryColorValue
  lineNum: string
}

export interface TemporaryRouteUpdateState {
  routeEntries: TemporaryRouteEntry[]
}

function createTemporaryColorValue(): TemporaryColorValue {
  return {
    mode: 'none',
    hex: '#ffffff',
  }
}

export function createTemporaryRouteEntry(): TemporaryRouteEntry {
  return {
    id: createId('temp-route-entry'),
    lineDisplay: '',
    lineDisplayColor: createTemporaryColorValue(),
    lineDisplayBgColor: createTemporaryColorValue(),
    lineNum: '',
  }
}

function parseHexColor(hex: string) {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!match) {
    throw new Error(`Invalid colour value: ${hex || '(empty)'}.`)
  }

  return {
    r: Number.parseInt(match[1]!.slice(0, 2), 16),
    g: Number.parseInt(match[1]!.slice(2, 4), 16),
    b: Number.parseInt(match[1]!.slice(4, 6), 16),
  }
}

function serializeColorValue(color: TemporaryColorValue) {
  if (color.mode === 'none') {
    return 'nil'
  }

  if (color.mode === 'auto') {
    throw new Error('Auto colour is not supported for temporary routes.')
  }

  const rgb = parseHexColor(color.hex)
  return `Color3.fromRGB(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

function serializeLineDisplay(value: string) {
  const normalized = inferLineDisplayValue(value)
  if (normalized.kind === 'nil') {
    return 'nil'
  }

  if (normalized.kind === 'number') {
    return normalized.value
  }

  return JSON.stringify(normalized.value)
}

function serializeLineNum(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return 'nil'
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error(`LineNum must be a positive integer when defined. Received ${value || '(empty)'}.`)
  }

  return normalized
}

function requireUniqueRouteKeys(routeEntries: TemporaryRouteEntry[]) {
  const keys = new Set<string>()

  for (const entry of routeEntries) {
    const key = `${inferLineDisplayValue(entry.lineDisplay).kind}:${inferLineDisplayValue(entry.lineDisplay).value}:${entry.lineNum.trim()}`
    if (keys.has(key)) {
      throw new Error(`A temporary route with the same LineDisplay and LineNum is duplicated.`)
    }

    keys.add(key)
  }
}

function serializeRouteEntry(entry: TemporaryRouteEntry) {
  return [
    'table.insert(Routes, {',
    `\tLineDisplay = ${serializeLineDisplay(entry.lineDisplay)},`,
    `\tLineDisplayColor = ${serializeColorValue(entry.lineDisplayColor)},`,
    `\tLineDisplayBgColor = ${serializeColorValue(entry.lineDisplayBgColor)},`,
    `\tLineNum = ${serializeLineNum(entry.lineNum)},`,
    '',
    '\tOrders = {',
    '\t\t{"panel", 910},',
    '\t},',
    '',
    '\tGroups = {},',
    '})',
  ].join('\n')
}

export function generateTemporaryRouteUpdateSource(state: TemporaryRouteUpdateState) {
  if (state.routeEntries.length === 0) {
    throw new Error('Add at least one temporary route entry before generating live update code.')
  }

  requireUniqueRouteKeys(state.routeEntries)

  return [
    'local BUSEV3 = game:GetService("ReplicatedStorage"):WaitForChild("BUSEV3")',
    'local Routes = require(BUSEV3:WaitForChild("Routes"))',
    ...state.routeEntries.map((entry) => serializeRouteEntry(entry)),
  ].join('\n\n')
}