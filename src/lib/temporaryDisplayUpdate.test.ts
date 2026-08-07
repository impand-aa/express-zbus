import { describe, expect, it } from 'vitest'

import {
  createTemporaryNumDisplayFrame,
  createTemporaryNumEntry,
  createTemporaryPanelEntry,
  generateTemporaryDisplayUpdateSource,
  parseTemporaryNumsModuleSource,
  parseTemporaryPanelsModuleSource,
} from './temporaryDisplayUpdate'

describe('temporaryDisplayUpdate', () => {
  it('generates a combined Color and Mono live update script for panels and nums', () => {
    const panelEntry = createTemporaryPanelEntry()
    panelEntry.panelId = '950'
    panelEntry.destination = 'Test destination'
    panelEntry.via = 'Via center'
    panelEntry.color.frontFrames[0] = {
      ...panelEntry.color.frontFrames[0]!,
      head: 'TEST DESTINATION',
      headColor: { mode: 'rgb', hex: '#ffffff' },
      headBgColor: { mode: 'rgb', hex: '#1a2b3c' },
      foot: 'VIA CENTER',
      footColor: { mode: 'rgb', hex: '#ffee00' },
      num: { mode: 'text', value: '950' },
      numColor: { mode: 'rgb', hex: '#101010' },
    }
    panelEntry.color.numsMode = 'frames'
    panelEntry.color.numsFrames = [
      {
        ...createTemporaryNumDisplayFrame(),
        num: { mode: 'text', value: '950' },
        numColor: { mode: 'auto', hex: '#ffffff' },
        numBgColor: { mode: 'rgb', hex: '#112233' },
      },
    ]
    panelEntry.mono.frontFrames[0] = {
      ...panelEntry.mono.frontFrames[0]!,
      head: 'TEST DESTINATION',
      headColor: { mode: 'auto', hex: '#ffffff' },
      headBgColor: { mode: 'auto', hex: '#ffffff' },
      num: { mode: 'false', value: '' },
      numBgColor: { mode: 'auto', hex: '#ffffff' },
    }
    panelEntry.mono.numsMode = 'false'

    const numEntry = createTemporaryNumEntry()
    numEntry.numId = '950'
    numEntry.color.num = 'rbxassetid://123'
    numEntry.color.numColor = { mode: 'auto', hex: '#ffffff' }
    numEntry.color.numBgColor = { mode: 'rgb', hex: '#334455' }
    numEntry.mono.num = '950'
    numEntry.mono.numColor = { mode: 'rgb', hex: '#ffffff' }

    const source = generateTemporaryDisplayUpdateSource({
      panelEntries: [panelEntry],
      numEntries: [numEntry],
    })

    expect(source).toContain('local BUSEV3 = game:GetService("ReplicatedStorage"):WaitForChild("BUSEV3")')
    expect(source).toContain('require(BUSEV3.Panels:WaitForChild("Color"))')
    expect(source).toContain('require(BUSEV3.Panels:WaitForChild("Mono"))')
    expect(source).toContain('require(BUSEV3.Nums:WaitForChild("Color"))')
    expect(source).toContain('require(BUSEV3.Nums:WaitForChild("Mono"))')
    expect(source).toContain('Panels[950] = {')
    expect(source).toContain('Destination = "Test destination", via = "Via center"')
    expect(source).toContain('NumColor = "auto"')
    expect(source).toContain('HeadColor = "auto"')
    expect(source).toContain('HeadBgColor = "auto"')
    expect(source).toContain('Nums = false')
    expect(source).toContain('Nums[950] = {')
    expect(source).toContain('Num = "rbxassetid://123"')
  })

  it('rejects duplicate ids', () => {
    const panelEntry = createTemporaryPanelEntry()
    panelEntry.panelId = '10'

    expect(() => generateTemporaryDisplayUpdateSource({
      panelEntries: [panelEntry, { ...createTemporaryPanelEntry(), panelId: '10' }],
      numEntries: [],
    })).toThrow('Panel ID 10 is duplicated.')
  })

  it('parses the real panels module into temporary import templates', () => {
    const source = require('node:fs').readFileSync(require('node:url').fileURLToPath(new URL('../../BUSEV3_source/Panels/Color/moduleScript.luau', import.meta.url)), 'utf8')

    const panels = parseTemporaryPanelsModuleSource(source)
    const panel13 = panels.find((entry) => entry.panelId === '13')

    expect(panels.length).toBeGreaterThan(30)
    expect(panel13?.destination).toBe('Depo Fabriky')
    expect(panel13?.color.frontFrames[0]?.head).toBe('DEPO FABRIKY')
    expect(panel13?.mono.frontFrames[0]?.num.value).toBe('▶')
    expect(panel13?.color.numsMode).toBe('frames')
  })

  it('parses the real nums module into temporary import templates', () => {
    const source = require('node:fs').readFileSync(require('node:url').fileURLToPath(new URL('../../BUSEV3_source/Nums/Color/moduleScript.luau', import.meta.url)), 'utf8')

    const nums = parseTemporaryNumsModuleSource(source)
    const num47 = nums.find((entry) => entry.numId === '47')

    expect(nums.length).toBeGreaterThan(20)
    expect(num47?.color.num).toBe('rbxassetid://12946468694')
    expect(num47?.mono.num).toBe('rbxassetid://12946468694')
  })
})