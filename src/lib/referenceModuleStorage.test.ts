import { describe, expect, it } from 'vitest'

import {
  REFERENCE_MODULE_STORAGE_KEY,
  loadPersistedReferenceModuleState,
  savePersistedReferenceModuleSources,
  serializePersistedReferenceModuleSources,
} from './referenceModuleStorage'

function createStorageStub(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues))

  return {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
    removeItem(key: string) {
      values.delete(key)
    },
  }
}

const ROUTES_SOURCE = `local Routes = {
  {
    LineDisplay = 1,
    Orders = {
      {"stop", "Alpha", "A", 0},
      {"stop", "Bravo", "B", 5},
    },
  },
}

return Routes
`

const PANELS_SOURCE = `local Panels = {
  [10] = {
    Destination = "Depot",
    DisplayFrames = {
      Front = {
        { Head = "DEPOT" },
      },
    },
  },
}

return Panels
`

const NUMS_SOURCE = `local Nums = {
  [10] = {
    LineDisplay = {
      Num = "rbxassetid://10", NumColor = nil, NumBgColor = nil,
    },
  },
}

return Nums
`

const SOUNDS_SOURCE = `local Sounds = {
  ["next_stop"] = "rbxassetid://1",
  ["Depot"] = "rbxassetid://2",
}

return {
  SoundBank = Sounds,
}
`

describe('reference module storage', () => {
  it('restores saved routes, panels, and sounds from storage', () => {
    const storage = createStorageStub()

    savePersistedReferenceModuleSources({
      routesSource: ROUTES_SOURCE,
      panelsSource: PANELS_SOURCE,
      numsSource: NUMS_SOURCE,
      soundsSource: SOUNDS_SOURCE,
    }, storage)

    const restoredState = loadPersistedReferenceModuleState(storage)

    expect(restoredState.restoredFromStorage).toBe(true)
    expect(restoredState.routesSource).toBe(ROUTES_SOURCE)
    expect(restoredState.importedRoutes).toHaveLength(1)
    expect(restoredState.importedRoutes[0]?.firstStopName).toBe('Alpha')
    expect(restoredState.importedRoutes[0]?.lastStopName).toBe('Bravo')
    expect(restoredState.routesError).toBe('')
    expect(restoredState.panelsSource).toBe(PANELS_SOURCE)
    expect(restoredState.importedPanels).toEqual([{ id: 10, destination: 'Depot' }])
    expect(restoredState.panelsError).toBe('')
    expect(restoredState.numsSource).toBe(NUMS_SOURCE)
    expect(restoredState.importedNumsCount).toBe(1)
    expect(restoredState.numsError).toBe('')
    expect(restoredState.soundsSource).toBe(SOUNDS_SOURCE)
    expect(restoredState.importedSounds).toEqual([
      { key: 'next_stop', assetId: 'rbxassetid://1' },
      { key: 'Depot', assetId: 'rbxassetid://2' },
    ])
    expect(restoredState.soundsError).toBe('')
    expect(restoredState.storageWarning).toBe('')
  })

  it('keeps saved source text even when one saved module no longer parses', () => {
    const storage = createStorageStub({
      [REFERENCE_MODULE_STORAGE_KEY]: serializePersistedReferenceModuleSources({
        routesSource: 'local Routes = { bad }',
        panelsSource: PANELS_SOURCE,
        numsSource: NUMS_SOURCE,
        soundsSource: SOUNDS_SOURCE,
      }),
    })

    const restoredState = loadPersistedReferenceModuleState(storage)

    expect(restoredState.routesSource).toBe('local Routes = { bad }')
    expect(restoredState.importedRoutes).toEqual([])
    expect(restoredState.routesError).not.toBe('')
    expect(restoredState.importedPanels).toEqual([{ id: 10, destination: 'Depot' }])
    expect(restoredState.panelsError).toBe('')
    expect(restoredState.importedNumsCount).toBe(1)
    expect(restoredState.numsError).toBe('')
    expect(restoredState.importedSounds).toEqual([
      { key: 'next_stop', assetId: 'rbxassetid://1' },
      { key: 'Depot', assetId: 'rbxassetid://2' },
    ])
    expect(restoredState.soundsError).toBe('')
  })

  it('skips unreadable saved data and removes the storage entry when both sources are empty', () => {
    const unreadableStorage = createStorageStub({
      [REFERENCE_MODULE_STORAGE_KEY]: '{not-json',
    })

    const restoredState = loadPersistedReferenceModuleState(unreadableStorage)

    expect(restoredState.restoredFromStorage).toBe(false)
    expect(restoredState.routesSource).toBe('')
    expect(restoredState.panelsSource).toBe('')
    expect(restoredState.numsSource).toBe('')
    expect(restoredState.soundsSource).toBe('')
    expect(restoredState.storageWarning).toBe('Saved routes/panels/nums/sounds data could not be read and was skipped.')

    const storage = createStorageStub({
      [REFERENCE_MODULE_STORAGE_KEY]: serializePersistedReferenceModuleSources({
        routesSource: ROUTES_SOURCE,
        panelsSource: PANELS_SOURCE,
        numsSource: NUMS_SOURCE,
        soundsSource: SOUNDS_SOURCE,
      }),
    })

    savePersistedReferenceModuleSources({
      routesSource: '',
      panelsSource: '   ',
      numsSource: '',
      soundsSource: '',
    }, storage)

    expect(storage.getItem(REFERENCE_MODULE_STORAGE_KEY)).toBeNull()
  })
})