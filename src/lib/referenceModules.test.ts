import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { createJourney } from './document'
import {
  findBestRouteMatch,
  getDisplayLinePreview,
  getInheritedOrdersPreview,
  getPanelDestination,
  parsePanelsModuleSource,
  parseRoutesModuleSource,
  parseSoundsModuleSource,
} from './referenceModules'

function loadSource(relativePath: string) {
  const absolutePath = fileURLToPath(new URL(`../../${relativePath}`, import.meta.url))
  return readFileSync(absolutePath, 'utf8')
}

describe('reference module parsers', () => {
  it('parses the real routes module', () => {
    const routes = parseRoutesModuleSource(loadSource('BUSEV3_source/Routes/moduleScript.luau'))

    expect(routes.length).toBeGreaterThan(20)
    expect(routes[0]?.orders[0]?.type).toBe('panel')
    expect(routes[1]?.lineDisplay).toEqual({
      kind: 'number',
      value: '1',
    })
    expect(routes[1]?.lineDisplayBgColor).toEqual({
      r: 0,
      g: 142,
      b: 156,
    })
  })

  it('parses the real panels module', () => {
    const panels = parsePanelsModuleSource(loadSource('BUSEV3_source/Panels/Color/moduleScript.luau'))

    expect(panels.length).toBeGreaterThan(30)
    expect(getPanelDestination(panels, '10')).toBe('Depo Fabriky')
    expect(getPanelDestination(panels, '28')).toBe('Mestský park')
  })

  it('parses the real sounds module', () => {
    const sounds = parseSoundsModuleSource(loadSource('BUSEV3_source/Sounds/moduleScript.luau'))

    expect(sounds.length).toBeGreaterThan(20)
    expect(sounds.find((sound) => sound.key === 'next_stop')?.assetId).toBe('rbxassetid://137631941363166')
    expect(sounds.find((sound) => sound.key === 'Hlavná stanica')?.assetId).toBe('rbxassetid://116757545399213')
  })

  it('matches routes using the shift source logic and exposes inherited orders', () => {
    const routes = parseRoutesModuleSource(loadSource('BUSEV3_source/Routes/moduleScript.luau'))
    const journey = createJourney({
      lineDisplay: { kind: 'number', value: '1' },
      from: 'Priemyselná zóna',
      to: 'Stn. Lipkov',
      orders: [],
    })

    const match = findBestRouteMatch(journey, routes)

    expect(match?.mode).toBe('source')
    expect(match?.route.firstStopName).toBe('Priemyselná zóna')
    expect(match?.route.lastStopName).toBe('Stn. Lipkov')
    expect(getInheritedOrdersPreview(journey, routes)).toHaveLength(15)
  })

  it('normalizes numeric-only line display values when matching routes', () => {
    const routes = parseRoutesModuleSource(loadSource('BUSEV3_source/Routes/moduleScript.luau'))
    const journey = createJourney({
      lineDisplay: { kind: 'string', value: '1' },
      from: 'Priemyselná zóna',
      to: 'Stn. Lipkov',
      orders: [],
    })

    const match = findBestRouteMatch(journey, routes)

    expect(match?.mode).toBe('source')
    expect(match?.route.firstStopName).toBe('Priemyselná zóna')
  })

  it('builds a display-line preview that mirrors Utility:DrawLine behavior', () => {
    const routes = parseRoutesModuleSource(loadSource('BUSEV3_source/Routes/moduleScript.luau'))
    const journey = createJourney({
      lineDisplay: { kind: 'nil', value: '' },
      from: 'Ikea',
      to: 'Ikea',
    })

    const preview = getDisplayLinePreview(journey, findBestRouteMatch(journey, routes))

    expect(preview).toEqual({
      text: '11',
      textColor: 'rgb(255, 255, 255)',
      backgroundColor: 'rgb(106, 106, 106)',
      isRounded: false,
    })
  })
})