export const SAVED_SHIFT_STORAGE_KEY = 'shiftmaker.savedShiftSources.v1'

type SavedShiftStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface SavedShiftSource {
  moduleName: string
  source: string
}

export interface LoadedSavedShiftState {
  savedShifts: SavedShiftSource[]
  restoredFromStorage: boolean
  storageWarning: string
}

function getStorage(storage?: SavedShiftStorageLike | null) {
  if (storage !== undefined) {
    return storage
  }

  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function normalizeModuleName(moduleName: string) {
  return moduleName.trim()
}

export function sortSavedShiftSources(savedShifts: SavedShiftSource[]) {
  return [...savedShifts].sort((left, right) => (
    left.moduleName.localeCompare(right.moduleName, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  ))
}

function normalizeSavedShiftSources(savedShifts: SavedShiftSource[]) {
  return sortSavedShiftSources(savedShifts.reduce<SavedShiftSource[]>((normalizedSources, savedShift) => {
    const moduleName = normalizeModuleName(savedShift.moduleName)
    if (!moduleName || !savedShift.source.trim()) {
      return normalizedSources
    }

    if (normalizedSources.some((existingSavedShift) => existingSavedShift.moduleName === moduleName)) {
      return normalizedSources
    }

    normalizedSources.push({
      moduleName,
      source: savedShift.source,
    })
    return normalizedSources
  }, []))
}

export function upsertSavedShiftSource(savedShifts: SavedShiftSource[], savedShift: SavedShiftSource) {
  const moduleName = normalizeModuleName(savedShift.moduleName)
  if (!moduleName || !savedShift.source.trim()) {
    return normalizeSavedShiftSources(savedShifts)
  }

  return normalizeSavedShiftSources([
    ...savedShifts.filter((existingSavedShift) => existingSavedShift.moduleName !== moduleName),
    {
      moduleName,
      source: savedShift.source,
    },
  ])
}

export function serializePersistedSavedShiftSources(savedShifts: SavedShiftSource[]) {
  return JSON.stringify(normalizeSavedShiftSources(savedShifts))
}

export function deserializePersistedSavedShiftSources(rawValue: string | null | undefined) {
  if (!rawValue) {
    return {
      savedShifts: [] as SavedShiftSource[],
      storageWarning: '',
    }
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown
    if (Array.isArray(parsedValue)) {
      return {
        savedShifts: normalizeSavedShiftSources(parsedValue.flatMap((entry) => {
          if (!entry || typeof entry !== 'object') {
            return []
          }

          const moduleName = typeof (entry as Record<string, unknown>).moduleName === 'string'
            ? (entry as Record<string, string>).moduleName
            : ''
          const source = typeof (entry as Record<string, unknown>).source === 'string'
            ? (entry as Record<string, string>).source
            : ''

          return moduleName && source ? [{ moduleName, source }] : []
        })),
        storageWarning: '',
      }
    }

    if (parsedValue && typeof parsedValue === 'object') {
      return {
        savedShifts: normalizeSavedShiftSources(Object.entries(parsedValue as Record<string, unknown>).flatMap(([moduleName, source]) => (
          typeof source === 'string' ? [{ moduleName, source }] : []
        ))),
        storageWarning: '',
      }
    }
  } catch {
    return {
      savedShifts: [] as SavedShiftSource[],
      storageWarning: 'Saved shifts could not be read and were skipped.',
    }
  }

  return {
    savedShifts: [] as SavedShiftSource[],
    storageWarning: 'Saved shifts could not be read and were skipped.',
  }
}

export function buildLoadedSavedShiftState(savedShifts: SavedShiftSource[], storageWarning = ''): LoadedSavedShiftState {
  const normalizedSavedShifts = normalizeSavedShiftSources(savedShifts)

  return {
    savedShifts: normalizedSavedShifts,
    restoredFromStorage: normalizedSavedShifts.length > 0,
    storageWarning,
  }
}

export function loadPersistedSavedShiftState(storage?: SavedShiftStorageLike | null): LoadedSavedShiftState {
  const resolvedStorage = getStorage(storage)
  const rawValue = resolvedStorage?.getItem(SAVED_SHIFT_STORAGE_KEY) ?? null
  const { savedShifts, storageWarning } = deserializePersistedSavedShiftSources(rawValue)

  return buildLoadedSavedShiftState(savedShifts, storageWarning)
}

export function savePersistedSavedShiftSources(savedShifts: SavedShiftSource[], storage?: SavedShiftStorageLike | null) {
  const resolvedStorage = getStorage(storage)
  if (!resolvedStorage) {
    return
  }

  const normalizedSavedShifts = normalizeSavedShiftSources(savedShifts)
  if (normalizedSavedShifts.length === 0) {
    resolvedStorage.removeItem(SAVED_SHIFT_STORAGE_KEY)
    return
  }

  resolvedStorage.setItem(SAVED_SHIFT_STORAGE_KEY, serializePersistedSavedShiftSources(normalizedSavedShifts))
}