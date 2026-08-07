import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { generateLiveShiftUpdateSource } from './liveShiftUpdate'

function loadShiftSource(relativePath: string) {
  const absolutePath = fileURLToPath(new URL(`../../${relativePath}`, import.meta.url))
  return readFileSync(absolutePath, 'utf8')
}

describe('generateLiveShiftUpdateSource', () => {
  it('wraps exported shift source in a RegisterShift console snippet', () => {
    const source = loadShiftSource('BUSEV3_source/Shifts/34/moduleScript.luau')
    const generated = generateLiveShiftUpdateSource(source, '34')

    expect(generated).toContain('SHIFT._plan = {')
    expect(generated).toContain('require(game:GetService("ReplicatedStorage").BUSEV3.Shifts):RegisterShift(SHIFT._plan, 34)')
    expect(generated).not.toContain('\nreturn SHIFT')
  })

  it('quotes non-numeric line values when generating the RegisterShift call', () => {
    const source = loadShiftSource('BUSEV3_source/Shifts/847/moduleScript.luau')
    const generated = generateLiveShiftUpdateSource(source, 'X47')

    expect(generated).toContain('require(game:GetService("ReplicatedStorage").BUSEV3.Shifts):RegisterShift(SHIFT._plan, "X47")')
  })
})