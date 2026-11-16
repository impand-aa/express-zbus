import type { ImportedPanelDefinition, ImportedRouteDefinition, ImportedSoundDefinition } from '../types'
import { parsePanelsModuleSource, parseRoutesModuleSource, parseSoundsModuleSource } from './referenceModules'
import { parseTemporaryNumsModuleSource, parseTemporaryPanelsModuleSource } from './temporaryDisplayUpdate'

export const REFERENCE_MODULE_STORAGE_KEY = 'shiftmaker.referenceModuleSources.v1'

// Each organization has its own reference modules, so the browser cache is kept per organization.
export function getReferenceModuleStorageKey(organizationId?: string) {
  return organizationId ? `${REFERENCE_MODULE_STORAGE_KEY}:${organizationId}` : REFERENCE_MODULE_STORAGE_KEY
}

type ReferenceModuleStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface PersistedReferenceModuleSources {
  routesSource: string
  panelsSource: string
  numsSource: string
  soundsSource: string
}

export interface LoadedReferenceModuleState extends PersistedReferenceModuleSources {
  importedRoutes: ImportedRouteDefinition[]
  importedPanels: ImportedPanelDefinition[]
  importedSounds: ImportedSoundDefinition[]
  importedNumsCount: number
  routesError: string
  panelsError: string
  numsError: string
  soundsError: string
  restoredFromStorage: boolean
  storageWarning: string
}

function createEmptyPersistedReferenceModuleSources(): PersistedReferenceModuleSources {
  return {
    routesSource: '',
    panelsSource: '',
    numsSource: '',
    soundsSource: '',
  }
}

function getStorage(storage?: ReferenceModuleStorageLike | null) {
  if (storage !== undefined) {
    return storage
  }

  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function parseRoutesSource(routesSource: string) {
  if (!routesSource.trim()) {
    return {
      importedRoutes: [] as ImportedRouteDefinition[],
      routesError: '',
    }
  }

  try {
    return {
      importedRoutes: parseRoutesModuleSource(routesSource),
      routesError: '',
    }
  } catch (error) {
    return {
      importedRoutes: [] as ImportedRouteDefinition[],
      routesError: getErrorMessage(error, 'Failed to import the saved routes module.'),
    }
  }
}

function parsePanelsSource(panelsSource: string) {
  if (!panelsSource.trim()) {
    return {
      importedPanels: [] as ImportedPanelDefinition[],
      panelsError: '',
    }
  }

  try {
    return {
      importedPanels: parsePanelsModuleSource(panelsSource),
      importedNumsCount: parseTemporaryPanelsModuleSource(panelsSource).length,
      panelsError: '',
    }
  } catch (error) {
    return {
      importedPanels: [] as ImportedPanelDefinition[],
      importedNumsCount: 0,
      panelsError: getErrorMessage(error, 'Failed to import the saved panels module.'),
    }
  }
}

function parseNumsSource(numsSource: string) {
  if (!numsSource.trim()) {
    return {
      importedNumsCount: 0,
      numsError: '',
    }
  }

  try {
    return {
      importedNumsCount: parseTemporaryNumsModuleSource(numsSource).length,
      numsError: '',
    }
  } catch (error) {
    return {
      importedNumsCount: 0,
      numsError: getErrorMessage(error, 'Failed to import the saved nums module.'),
    }
  }
}

function parseSoundsSource(soundsSource: string) {
  if (!soundsSource.trim()) {
    return {
      importedSounds: [] as ImportedSoundDefinition[],
      soundsError: '',
    }
  }

  try {
    return {
      importedSounds: parseSoundsModuleSource(soundsSource),
      soundsError: '',
    }
  } catch (error) {
    return {
      importedSounds: [] as ImportedSoundDefinition[],
      soundsError: getErrorMessage(error, 'Failed to import the saved sounds module.'),
    }
  }
}

export function serializePersistedReferenceModuleSources(sources: PersistedReferenceModuleSources) {
  return JSON.stringify(sources)
}

export function deserializePersistedReferenceModuleSources(rawValue: string | null | undefined) {
  if (!rawValue) {
    return {
      sources: createEmptyPersistedReferenceModuleSources(),
      storageWarning: '',
    }
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Record<string, unknown> | null

    return {
      sources: {
        routesSource: typeof parsedValue?.routesSource === 'string' ? parsedValue.routesSource : '',
        panelsSource: typeof parsedValue?.panelsSource === 'string' ? parsedValue.panelsSource : '',
        numsSource: typeof parsedValue?.numsSource === 'string' ? parsedValue.numsSource : '',
        soundsSource: typeof parsedValue?.soundsSource === 'string' ? parsedValue.soundsSource : '',
      },
      storageWarning: '',
    }
  } catch {
    return {
      sources: createEmptyPersistedReferenceModuleSources(),
      storageWarning: 'Saved routes/panels/nums/sounds data could not be read and was skipped.',
    }
  }
}

export function buildLoadedReferenceModuleState(sources: PersistedReferenceModuleSources, storageWarning = ''): LoadedReferenceModuleState {
  const parsedRoutes = parseRoutesSource(sources.routesSource)
  const parsedPanels = parsePanelsSource(sources.panelsSource)
  const parsedNums = parseNumsSource(sources.numsSource)
  const parsedSounds = parseSoundsSource(sources.soundsSource)

  return {
    ...sources,
    ...parsedRoutes,
    ...parsedPanels,
    ...parsedNums,
    ...parsedSounds,
    restoredFromStorage: Boolean(sources.routesSource.trim() || sources.panelsSource.trim() || sources.numsSource.trim() || sources.soundsSource.trim()),
    storageWarning,
  }
}

export function loadPersistedReferenceModuleState(
  storage?: ReferenceModuleStorageLike | null,
  organizationId?: string,
): LoadedReferenceModuleState {
  const resolvedStorage = getStorage(storage)
  const rawValue = resolvedStorage?.getItem(getReferenceModuleStorageKey(organizationId)) ?? null
  const { sources, storageWarning } = deserializePersistedReferenceModuleSources(rawValue)

  return buildLoadedReferenceModuleState(sources, storageWarning)
}

export function savePersistedReferenceModuleSources(
  sources: PersistedReferenceModuleSources,
  storage?: ReferenceModuleStorageLike | null,
  organizationId?: string,
) {
  const resolvedStorage = getStorage(storage)
  if (!resolvedStorage) {
    return
  }

  const storageKey = getReferenceModuleStorageKey(organizationId)

  if (!sources.routesSource.trim() && !sources.panelsSource.trim() && !sources.numsSource.trim() && !sources.soundsSource.trim()) {
    resolvedStorage.removeItem(storageKey)
    return
  }

  resolvedStorage.setItem(storageKey, serializePersistedReferenceModuleSources(sources))
}