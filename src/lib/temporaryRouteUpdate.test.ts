import { describe, expect, it } from 'vitest'

import { createTemporaryRouteEntry, generateTemporaryRouteUpdateSource } from './temporaryRouteUpdate'

describe('temporaryRouteUpdate', () => {
  it('generates a temporary route live update script with a fixed panel 910 order', () => {
    const entry = createTemporaryRouteEntry()
    entry.lineDisplay = 'X47'
    entry.lineDisplayColor = { mode: 'rgb', hex: '#ffffff' }
    entry.lineDisplayBgColor = { mode: 'rgb', hex: '#0e8e9c' }
    entry.lineNum = '847'

    const source = generateTemporaryRouteUpdateSource({
      routeEntries: [entry],
    })

    expect(source).toContain('local Routes = require(BUSEV3:WaitForChild("Routes"))')
    expect(source).toContain('LineDisplay = "X47"')
    expect(source).toContain('LineDisplayColor = Color3.fromRGB(255, 255, 255)')
    expect(source).toContain('LineDisplayBgColor = Color3.fromRGB(14, 142, 156)')
    expect(source).toContain('LineNum = 847')
    expect(source).toContain('{"panel", 910}')
    expect(source).toContain('Groups = {}')
  })

  it('rejects duplicate temporary routes by line display and line num', () => {
    const first = createTemporaryRouteEntry()
    first.lineDisplay = '1'
    first.lineNum = '1'

    const second = createTemporaryRouteEntry()
    second.lineDisplay = '1'
    second.lineNum = '1'

    expect(() => generateTemporaryRouteUpdateSource({
      routeEntries: [first, second],
    })).toThrow('A temporary route with the same LineDisplay and LineNum is duplicated.')
  })
})