import { describe, expect, it } from 'vitest'

import {
  SAVED_SHIFT_STORAGE_KEY,
  loadPersistedSavedShiftState,
  savePersistedSavedShiftSources,
  serializePersistedSavedShiftSources,
  upsertSavedShiftSource,
} from './savedShiftStorage'

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

const SHIFT_34_SOURCE = 'return { [1] = { Name = "34" } }'
const SHIFT_847_SOURCE = 'return { [1] = { Name = "847" } }'

describe('saved shift storage', () => {
  it('restores saved shifts from storage in module-name order', () => {
    const storage = createStorageStub()

    savePersistedSavedShiftSources([
      { moduleName: '847', source: SHIFT_847_SOURCE },
      { moduleName: '34', source: SHIFT_34_SOURCE },
    ], storage)

    const restoredState = loadPersistedSavedShiftState(storage)

    expect(restoredState.restoredFromStorage).toBe(true)
    expect(restoredState.savedShifts.map((savedShift) => savedShift.moduleName)).toEqual(['34', '847'])
    expect(restoredState.savedShifts[1]?.source).toBe(SHIFT_847_SOURCE)
    expect(restoredState.storageWarning).toBe('')
  })

  it('updates an existing saved shift by module name', () => {
    const nextSavedShifts = upsertSavedShiftSource([
      { moduleName: '847', source: SHIFT_34_SOURCE },
    ], {
      moduleName: '847',
      source: SHIFT_847_SOURCE,
    })

    expect(nextSavedShifts).toEqual([
      { moduleName: '847', source: SHIFT_847_SOURCE },
    ])
  })

  it('skips unreadable saved data and removes the storage entry when memory is empty', () => {
    const unreadableStorage = createStorageStub({
      [SAVED_SHIFT_STORAGE_KEY]: '{not-json',
    })

    const restoredState = loadPersistedSavedShiftState(unreadableStorage)

    expect(restoredState.restoredFromStorage).toBe(false)
    expect(restoredState.savedShifts).toEqual([])
    expect(restoredState.storageWarning).toBe('Saved shifts could not be read and were skipped.')

    const storage = createStorageStub({
      [SAVED_SHIFT_STORAGE_KEY]: serializePersistedSavedShiftSources([
        { moduleName: '847', source: SHIFT_847_SOURCE },
      ]),
    })

    savePersistedSavedShiftSources([], storage)

    expect(storage.getItem(SAVED_SHIFT_STORAGE_KEY)).toBeNull()
  })
})