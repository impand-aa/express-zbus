import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, ButtonGroup, Container, Dropdown, Stack } from 'react-bootstrap'

import './App.css'

import { ImportExportTab } from './components/ImportExportTab'
import { ConfirmModal } from './components/ConfirmModal'
import { IntegrityConfigModal } from './components/IntegrityConfigModal'
import { LiveDisplayUpdateModal } from './components/LiveDisplayUpdateModal'
import { LiveRouteUpdateModal } from './components/LiveRouteUpdateModal'
import { JourneyEditorPanel } from './components/JourneyEditorPanel'
import { LiveShiftUpdateModal } from './components/LiveShiftUpdateModal'
import { ModuleSourcesTab } from './components/ModuleSourcesTab'
import { OperationsOverviewTab } from './components/OperationsOverviewTab'
import { PublishesTab } from './components/PublishesTab'
import { ShiftOrdersPanel } from './components/ShiftOrdersPanel'
import { TemporaryDisplaysTab } from './components/TemporaryDisplaysTab'
import { TemporaryRoutesTab } from './components/TemporaryRoutesTab'
import { SavedShiftsModal } from './components/SavedShiftsModal'
import { UserMenu } from './components/UserMenu'
import { useAuth } from './components/AuthGate'
import {
  buildUniqueJourneyKey,
  cloneShiftOrder,
  createEmptyDocument,
  createJourney,
  createJourneyNode,
  createShiftOrder,
  createTimeNode,
  duplicateJourneyDefinition,
  getNextShiftOrderNumber,
  validateDocument,
} from './lib/document'
import { buildIntegrityWarnings, createDefaultIntegrityConfig, getIntegrityConfigIssue } from './lib/integrity'
import { generateShiftModuleSource, parseShiftModuleSource } from './lib/luauShift'
import { loadPersistedReferenceModuleState, savePersistedReferenceModuleSources } from './lib/referenceModuleStorage'
import { fetchReferenceModules, saveReferenceModule } from './lib/referenceModuleApi'
import { parsePanelsModuleSource, parseRoutesModuleSource, parseSoundsModuleSource } from './lib/referenceModules'
import { fetchAllShifts, saveShift, upsertShiftRecord } from './lib/shiftApi'
import {
  createPublishRequest,
  deletePublishRequest,
  fetchPublishRequests,
  setPublishRequestStatus,
  type PublishRequestRecord,
  type PublishRequestStatus,
  type PublishRequestType,
} from './lib/publishRequestApi'
import type { AppendedSubstituteServicePlan } from './lib/substituteServicePlanner'
import {
  cloneTemporaryNumEntry,
  cloneTemporaryPanelEntry,
  generateTemporaryDisplayUpdateSource,
  parseTemporaryNumsModuleSource,
  parseTemporaryPanelsModuleSource,
  type TemporaryNumEntry,
  type TemporaryPanelEntry,
} from './lib/temporaryDisplayUpdate'
import {
  generateTemporaryRouteUpdateSource,
  type TemporaryRouteEntry,
} from './lib/temporaryRouteUpdate'
import type {
  ImportedPanelDefinition,
  ImportedRouteDefinition,
  ImportedSoundDefinition,
  JourneyDefinition,
  ShiftDocument,
  ShiftOrder,
  ShiftPlanNode,
} from './types'
import type { ShiftRecord } from './lib/shiftApi'

type Notice = {
  variant: 'success' | 'danger' | 'info' | 'warning'
  text: string
}

type WorkspaceTab = 'build' | 'overview' | 'io' | 'modules' | 'displays' | 'routes' | 'publishes'

function getExportState(document: ShiftDocument) {
  try {
    return {
      error: '',
      source: generateShiftModuleSource(document),
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not generate Luau output.',
      source: '',
    }
  }
}

function getInitialNotice(
  initialReferenceModulesState: ReturnType<typeof loadPersistedReferenceModuleState>,
): Notice {
  if (initialReferenceModulesState.storageWarning) {
    return {
      text: initialReferenceModulesState.storageWarning,
      variant: 'warning',
    }
  }

  if (!initialReferenceModulesState.restoredFromStorage) {
    return {
      text: 'Ready.',
      variant: 'info',
    }
  }

  const restoredStates = [
    initialReferenceModulesState.routesSource.trim()
      ? initialReferenceModulesState.routesError
        ? 'saved routes source needs reimport review'
        : `${initialReferenceModulesState.importedRoutes.length} route${initialReferenceModulesState.importedRoutes.length === 1 ? '' : 's'}`
      : '',
    initialReferenceModulesState.panelsSource.trim()
      ? initialReferenceModulesState.panelsError
        ? 'saved panels source needs reimport review'
        : `${initialReferenceModulesState.importedPanels.length} panel${initialReferenceModulesState.importedPanels.length === 1 ? '' : 's'}`
      : '',
    initialReferenceModulesState.numsSource.trim()
      ? initialReferenceModulesState.numsError
        ? 'saved nums source needs reimport review'
        : `${initialReferenceModulesState.importedNumsCount} num${initialReferenceModulesState.importedNumsCount === 1 ? '' : 's'}`
      : '',
    initialReferenceModulesState.soundsSource.trim()
      ? initialReferenceModulesState.soundsError
        ? 'saved sounds source needs reimport review'
        : `${initialReferenceModulesState.importedSounds.length} sound${initialReferenceModulesState.importedSounds.length === 1 ? '' : 's'}`
      : '',
  ].filter(Boolean)

  if (restoredStates.length === 0) {
    return {
      text: 'Ready.',
      variant: 'info',
    }
  }

  return {
    text: `Restored ${restoredStates.join(' and ')} from local storage.`,
    variant: initialReferenceModulesState.routesError || initialReferenceModulesState.panelsError || initialReferenceModulesState.soundsError ? 'warning' : 'info',
  }
}

function App() {
  const { token, rank, username } = useAuth()
  const [initialReferenceModulesState] = useState(loadPersistedReferenceModuleState)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('build')
  const [document, setDocument] = useState<ShiftDocument>(() => createEmptyDocument())
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null)
  const [selectedShiftOrderId, setSelectedShiftOrderId] = useState<string | null>(null)
  const [downloadName, setDownloadName] = useState('shift_module')
  const [importSource, setImportSource] = useState('')
  const [shiftModuleName, setShiftModuleName] = useState('')
  const [routesSource, setRoutesSource] = useState(initialReferenceModulesState.routesSource)
  const [panelsSource, setPanelsSource] = useState(initialReferenceModulesState.panelsSource)
  const [numsSource, setNumsSource] = useState(initialReferenceModulesState.numsSource)
  const [soundsSource, setSoundsSource] = useState(initialReferenceModulesState.soundsSource)
  const [savedShifts, setSavedShifts] = useState<ShiftRecord[]>([])
  const [showSavedShiftsModal, setShowSavedShiftsModal] = useState(false)
  const [savedShiftsModalMode, setSavedShiftsModalMode] = useState<'save' | 'browse'>('browse')
  const [savingShiftModuleName, setSavingShiftModuleName] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    title?: string
    message: string
    confirmLabel?: string
    resolve: (result: boolean) => void
  } | null>(null)
  const [publishRequests, setPublishRequests] = useState<PublishRequestRecord[]>([])
  const [creatingPublishRequest, setCreatingPublishRequest] = useState(false)
  const [updatingPublishRequestId, setUpdatingPublishRequestId] = useState<string | null>(null)
  const [importedRoutes, setImportedRoutes] = useState<ImportedRouteDefinition[]>(initialReferenceModulesState.importedRoutes)
  const [importedPanels, setImportedPanels] = useState<ImportedPanelDefinition[]>(initialReferenceModulesState.importedPanels)
  const [importedPanelTemplates, setImportedPanelTemplates] = useState<TemporaryPanelEntry[]>(() => {
    if (initialReferenceModulesState.panelsError || !initialReferenceModulesState.panelsSource.trim()) {
      return []
    }

    try {
      return parseTemporaryPanelsModuleSource(initialReferenceModulesState.panelsSource)
    } catch {
      return []
    }
  })
  const [importedNumsCount, setImportedNumsCount] = useState(initialReferenceModulesState.importedNumsCount)
  const [importedNumTemplates, setImportedNumTemplates] = useState<TemporaryNumEntry[]>(() => {
    if (initialReferenceModulesState.numsError || !initialReferenceModulesState.numsSource.trim()) {
      return []
    }

    try {
      return parseTemporaryNumsModuleSource(initialReferenceModulesState.numsSource)
    } catch {
      return []
    }
  })
  const [importedSounds, setImportedSounds] = useState<ImportedSoundDefinition[]>(initialReferenceModulesState.importedSounds)
  const [temporaryPanelEntries, setTemporaryPanelEntries] = useState<TemporaryPanelEntry[]>([])
  const [temporaryNumEntries, setTemporaryNumEntries] = useState<TemporaryNumEntry[]>([])
  const [temporaryRouteEntries, setTemporaryRouteEntries] = useState<TemporaryRouteEntry[]>([])
  const [integrityConfig, setIntegrityConfig] = useState(createDefaultIntegrityConfig)
  const [showIntegrityConfigModal, setShowIntegrityConfigModal] = useState(false)
  const [showLiveShiftUpdateModal, setShowLiveShiftUpdateModal] = useState(false)
  const [showLiveDisplayUpdateModal, setShowLiveDisplayUpdateModal] = useState(false)
  const [showLiveRouteUpdateModal, setShowLiveRouteUpdateModal] = useState(false)
  const overviewDocuments = useMemo(() => {
    const normalizedShiftModuleName = shiftModuleName.trim()
    const parsedSavedDocuments = savedShifts.flatMap((savedShift) => {
      if (normalizedShiftModuleName && savedShift.moduleName === normalizedShiftModuleName) {
        return []
      }

      try {
        return [parseShiftModuleSource(savedShift.source)]
      } catch {
        return []
      }
    })

    return [document, ...parsedSavedDocuments]
  }, [document, savedShifts, shiftModuleName])
  const [routesImportError, setRoutesImportError] = useState(initialReferenceModulesState.routesError)
  const [panelsImportError, setPanelsImportError] = useState(initialReferenceModulesState.panelsError)
  const [numsImportError, setNumsImportError] = useState(initialReferenceModulesState.numsError)
  const [soundsImportError, setSoundsImportError] = useState(initialReferenceModulesState.soundsError)
  const [notice, setNotice] = useState<Notice>(() => getInitialNotice(initialReferenceModulesState))
  const [referenceModuleSyncError, setReferenceModuleSyncError] = useState('')
  const [savingModuleType, setSavingModuleType] = useState<'routes' | 'panels' | 'nums' | 'sounds' | null>(null)

  const deferredDocument = useDeferredValue(document)
  const validation = validateDocument(document)
  const liveExport = getExportState(document)
  const previewExport = getExportState(deferredDocument)
  const integrityConfigIssue = getIntegrityConfigIssue(integrityConfig)
  const temporaryDisplayUpdatePreview = useMemo(() => {
    try {
      return {
        error: '',
        source: generateTemporaryDisplayUpdateSource({
          panelEntries: temporaryPanelEntries,
          numEntries: temporaryNumEntries,
        }),
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Could not generate temporary display live update code.',
        source: '',
      }
    }
  }, [temporaryNumEntries, temporaryPanelEntries])
  const temporaryRouteUpdatePreview = useMemo(() => {
    try {
      return {
        error: '',
        source: generateTemporaryRouteUpdateSource({
          routeEntries: temporaryRouteEntries,
        }),
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Could not generate temporary route live update code.',
        source: '',
      }
    }
  }, [temporaryRouteEntries])
  const integrityWarnings = useMemo(() => buildIntegrityWarnings(document, importedRoutes, integrityConfig), [document, importedRoutes, integrityConfig])
  const journeyCount = document.journeys.length
  const shiftOrderCount = document.shiftOrders.length
  const planNodeCount = document.shiftOrders.reduce((total, order) => total + order.nodes.length, 0)
  const validationCount = validation.errors.length
  const exportReady = validationCount === 0 && !liveExport.error
  const visibleIntegrityWarnings = integrityWarnings.slice(0, 6)
  const remainingIntegrityWarnings = Math.max(0, integrityWarnings.length - visibleIntegrityWarnings.length)
  const hasEnabledIntegrityRanges = integrityConfig.intervalRanges.some((range) => range.enabled)

  useEffect(() => {
    if (!document.journeys.find((journey) => journey.id === selectedJourneyId)) {
      setSelectedJourneyId(document.journeys[0]?.id ?? null)
    }
  }, [document.journeys, selectedJourneyId])

  useEffect(() => {
    if (!document.shiftOrders.find((order) => order.id === selectedShiftOrderId)) {
      const firstOrder = [...document.shiftOrders].sort((left, right) => left.orderNumber - right.orderNumber)[0]
      setSelectedShiftOrderId(firstOrder?.id ?? null)
    }
  }, [document.shiftOrders, selectedShiftOrderId])

  useEffect(() => {
    syncReferenceModulesFromServer()
    syncShiftsFromServer()
    syncPublishRequestsFromServer()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per session on sign-in
  }, [token])

  useEffect(() => {
    savePersistedReferenceModuleSources({
      routesSource,
      panelsSource,
      numsSource,
      soundsSource,
    })
  }, [numsSource, panelsSource, routesSource, soundsSource])

  function setDefaultDownloadName(moduleName: string) {
    setDownloadName((currentDownloadName) => (
      currentDownloadName.trim() && currentDownloadName !== 'shift_module'
        ? currentDownloadName
        : moduleName
    ))
  }

  function requireShiftModuleName(actionDescription: string) {
    const normalizedModuleName = shiftModuleName.trim()
    if (!normalizedModuleName) {
      setNotice({
        text: `Enter a shift module name such as 847 before ${actionDescription}.`,
        variant: 'warning',
      })
      return null
    }

    return normalizedModuleName
  }

  function requestConfirmation(message: string, options?: { title?: string; confirmLabel?: string }): Promise<boolean> {
    return new Promise((resolve) => {
      setConfirmDialog({
        message,
        title: options?.title,
        confirmLabel: options?.confirmLabel,
        resolve,
      })
    })
  }

  function resolveConfirmDialog(result: boolean) {
    confirmDialog?.resolve(result)
    setConfirmDialog(null)
  }

  async function saveShiftToServer(moduleName: string, source: string) {
    const normalizedModuleName = moduleName.trim()
    const wasExisting = savedShifts.some((savedShift) => savedShift.moduleName === normalizedModuleName)

    setSavingShiftModuleName(normalizedModuleName)
    try {
      const record = await saveShift(token, normalizedModuleName, source)
      setSavedShifts((currentSavedShifts) => upsertShiftRecord(currentSavedShifts, record))
      setShiftModuleName(normalizedModuleName)
      setDefaultDownloadName(normalizedModuleName)

      return {
        moduleName: normalizedModuleName,
        wasExisting,
      }
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : `Failed to save shift ${normalizedModuleName} to the server.`,
        variant: 'danger',
      })
      return null
    } finally {
      setSavingShiftModuleName(null)
    }
  }

  async function saveCurrentExportToServer(actionDescription: string) {
    if (liveExport.error) {
      setNotice({
        text: liveExport.error,
        variant: 'danger',
      })
      return null
    }

    const moduleName = requireShiftModuleName(actionDescription)
    if (!moduleName) {
      return null
    }

    return saveShiftToServer(moduleName, liveExport.source)
  }

  async function syncShiftsFromServer() {
    try {
      const shifts = await fetchAllShifts(token)
      setSavedShifts(shifts)
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Failed to load saved shifts from the server.',
        variant: 'danger',
      })
    }
  }

  async function syncPublishRequestsFromServer() {
    try {
      const requests = await fetchPublishRequests(token)
      setPublishRequests(requests)
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Failed to load publish requests from the server.',
        variant: 'danger',
      })
    }
  }

  async function createPublishRequestOnServer(request: { type: PublishRequestType; objectId: string | null; description: string; data: string }) {
    if ((request.type === 'shift' && !request.objectId?.trim()) || !request.description.trim() || !request.data.trim()) {
      setNotice({
        text: 'Enter a description and paste the Luau source before requesting a publish (and an object ID for shifts).',
        variant: 'warning',
      })
      return
    }

    setCreatingPublishRequest(true)
    try {
      const created = await createPublishRequest(token, request)
      setPublishRequests((currentRequests) => [created, ...currentRequests])
      setNotice({
        text: `Requested a publish for ${request.type}${request.objectId ? ` ${request.objectId}` : ''}.`,
        variant: 'success',
      })
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Failed to request the publish.',
        variant: 'danger',
      })
    } finally {
      setCreatingPublishRequest(false)
    }
  }

  async function updatePublishRequestStatus(id: string, status: PublishRequestStatus) {
    setUpdatingPublishRequestId(id)
    try {
      const updated = await setPublishRequestStatus(token, id, status)
      setPublishRequests((currentRequests) => currentRequests.map((request) => (
        request.id === id ? updated : request
      )))
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Failed to update the publish request status.',
        variant: 'danger',
      })
    } finally {
      setUpdatingPublishRequestId(null)
    }
  }

  async function deletePublishRequestFromServer(id: string) {
    const shouldDelete = await requestConfirmation('Delete this publish request? This cannot be undone.', {
      title: 'Delete publish request?',
      confirmLabel: 'Delete',
    })
    if (!shouldDelete) {
      return
    }

    setUpdatingPublishRequestId(id)
    try {
      await deletePublishRequest(token, id)
      setPublishRequests((currentRequests) => currentRequests.filter((request) => request.id !== id))
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Failed to delete the publish request.',
        variant: 'danger',
      })
    } finally {
      setUpdatingPublishRequestId(null)
    }
  }

  function updateJourney(journeyId: string, updater: (journey: JourneyDefinition) => JourneyDefinition) {
    setDocument((currentDocument) => ({
      ...currentDocument,
      journeys: currentDocument.journeys.map((journey) => (
        journey.id === journeyId ? updater(journey) : journey
      )),
    }))
  }

  function updateShiftOrder(orderId: string, updater: (order: ShiftOrder) => ShiftOrder) {
    setDocument((currentDocument) => ({
      ...currentDocument,
      shiftOrders: currentDocument.shiftOrders.map((order) => (
        order.id === orderId ? updater(order) : order
      )),
    }))
  }

  function addJourney() {
    let newJourneyId: string | null = null

    setDocument((currentDocument) => ({
      ...currentDocument,
      journeys: [
        ...currentDocument.journeys,
        (() => {
          const newJourney = createJourney({
            key: buildUniqueJourneyKey(currentDocument.journeys, `journey_${currentDocument.journeys.length + 1}`),
          })
          newJourneyId = newJourney.id
          return newJourney
        })(),
      ],
    }))

    if (newJourneyId) {
      setSelectedJourneyId(newJourneyId)
    }
  }

  function duplicateJourney(journeyId: string) {
    let duplicatedJourneyId: string | null = null

    setDocument((currentDocument) => {
      const sourceJourney = currentDocument.journeys.find((journey) => journey.id === journeyId)
      if (!sourceJourney) {
        return currentDocument
      }

      const duplicatedJourney = duplicateJourneyDefinition(sourceJourney, currentDocument.journeys)
      duplicatedJourneyId = duplicatedJourney.id

      return {
        ...currentDocument,
        journeys: [...currentDocument.journeys, duplicatedJourney],
      }
    })

    if (duplicatedJourneyId) {
      setSelectedJourneyId(duplicatedJourneyId)
    }
  }

  function removeJourney(journeyId: string) {
    setDocument((currentDocument) => ({
      journeys: currentDocument.journeys.filter((journey) => journey.id !== journeyId),
      shiftOrders: currentDocument.shiftOrders.map((order) => ({
        ...order,
        nodes: order.nodes.reduce<ShiftPlanNode[]>((nextNodes, node) => {
          if (node.kind === 'time') {
            nextNodes.push(node)
            return nextNodes
          }

          const nextJourneyIds = node.journeyIds.filter((currentJourneyId) => currentJourneyId !== journeyId)
          if (nextJourneyIds.length === 0) {
            return nextNodes
          }

          nextNodes.push({
            ...node,
            journeyIds: nextJourneyIds,
          })

          return nextNodes
        }, []),
      })),
    }))

    setNotice({
      text: 'Journey removed.',
      variant: 'info',
    })
  }

  function addShiftOrder() {
    let createdOrderId: string | null = null

    setDocument((currentDocument) => {
      const nextOrderNodes: ShiftPlanNode[] = [createTimeNode('04:30')]
      if (currentDocument.journeys[0]) {
        nextOrderNodes.push(createJourneyNode([currentDocument.journeys[0].id]))
      }

      const newOrder = createShiftOrder(getNextShiftOrderNumber(currentDocument), nextOrderNodes)
      createdOrderId = newOrder.id

      return {
        ...currentDocument,
        shiftOrders: [
          ...currentDocument.shiftOrders,
          newOrder,
        ],
      }
    })

    if (createdOrderId) {
      setSelectedShiftOrderId(createdOrderId)
    }
  }

  function deleteShiftOrder(orderId: string) {
    setDocument((currentDocument) => ({
      ...currentDocument,
      shiftOrders: currentDocument.shiftOrders.filter((order) => order.id !== orderId),
    }))

    setNotice({
      text: 'Shift order removed.',
      variant: 'info',
    })
  }

  function cloneOrderSeries(orderId: string, copies: number, minuteStep: number) {
    if (!Number.isInteger(copies) || copies <= 0) {
      setNotice({
        text: 'Copy count must be a positive integer.',
        variant: 'warning',
      })
      return
    }

    if (Number.isNaN(minuteStep)) {
      setNotice({
        text: 'Minute step must be numeric.',
        variant: 'warning',
      })
      return
    }

    setDocument((currentDocument) => {
      const sourceOrder = currentDocument.shiftOrders.find((order) => order.id === orderId)
      if (!sourceOrder) {
        return currentDocument
      }

      const nextOrderNumber = getNextShiftOrderNumber(currentDocument)
      const clones = Array.from({ length: copies }, (_, index) => cloneShiftOrder(
        sourceOrder,
        nextOrderNumber + index,
        minuteStep * (index + 1),
      ))

      return {
        ...currentDocument,
        shiftOrders: [...currentDocument.shiftOrders, ...clones],
      }
    })

    setNotice({
      text: `Generated ${copies} additional order${copies === 1 ? '' : 's'}.`,
      variant: 'success',
    })
  }

  function appendPlannedSubstituteService(plan: AppendedSubstituteServicePlan) {
    if (plan.createdOrders.length === 0) {
      setNotice({
        text: 'The planner did not produce any committable shift orders.',
        variant: 'warning',
      })
      return
    }

    startTransition(() => {
      setDocument(plan.document)
      setSelectedShiftOrderId(plan.firstCreatedOrderId)
      setActiveTab('build')
      const updatedJourneyCount = plan.journeyChanges.filter((change) => change.kind === 'current-retime').length
      setNotice({
        text: `Appended ${plan.createdOrders.length} planned order${plan.createdOrders.length === 1 ? '' : 's'}${plan.importedJourneys.length > 0 ? ` and added ${plan.importedJourneys.length} journey definition${plan.importedJourneys.length === 1 ? '' : 's'}` : ''}${updatedJourneyCount > 0 ? `${plan.importedJourneys.length > 0 ? ' and' : ' and'} updated ${updatedJourneyCount} existing journey${updatedJourneyCount === 1 ? '' : 's'}` : ''}${plan.warnings.length > 0 ? ` (${plan.warnings.length} warning${plan.warnings.length === 1 ? '' : 's'})` : ''}.`,
        variant: plan.warnings.length > 0 ? 'warning' : 'success',
      })
    })
  }

  async function copyExport() {
    const saveResult = await saveCurrentExportToServer('exporting this shift')
    if (!saveResult) {
      return
    }

    try {
      await navigator.clipboard.writeText(liveExport.source)
      setNotice({
        text: `Luau source copied to the clipboard and ${saveResult.wasExisting ? 'updated' : 'saved'} as shift ${saveResult.moduleName}.`,
        variant: 'success',
      })
    } catch {
      setNotice({
        text: `Clipboard access failed. The export is still available in the text area and was ${saveResult.wasExisting ? 'updated' : 'saved'} as shift ${saveResult.moduleName}.`,
        variant: 'warning',
      })
    }
  }

  async function downloadExport() {
    const saveResult = await saveCurrentExportToServer('exporting this shift')
    if (!saveResult) {
      return
    }

    const safeFileName = `${downloadName.trim().replace(/[^A-Za-z0-9_-]+/g, '_') || 'shift_module'}.luau`
    const blob = new Blob([liveExport.source], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = globalThis.document.createElement('a')

    anchor.href = url
    anchor.download = safeFileName
    anchor.click()
    URL.revokeObjectURL(url)

    setNotice({
      text: `Downloaded ${safeFileName} and ${saveResult.wasExisting ? 'updated' : 'saved'} shift ${saveResult.moduleName} on the server.`,
      variant: 'success',
    })
  }

  async function importFromSource() {
    if (!importSource.trim()) {
      setNotice({
        text: 'Paste a shift module into the import panel first.',
        variant: 'warning',
      })
      return
    }

    try {
      const moduleName = requireShiftModuleName('importing from source')
      if (!moduleName) {
        return
      }

      const parsedDocument = parseShiftModuleSource(importSource)
      const normalizedSource = generateShiftModuleSource(parsedDocument)
      const shouldSaveToServer = await requestConfirmation(
        `Save the imported shift to the server as module ${moduleName}? This will overwrite any existing shift saved under that name.`,
        { title: 'Save imported shift?', confirmLabel: 'Save to server' },
      )
      const saveResult = shouldSaveToServer ? await saveShiftToServer(moduleName, normalizedSource) : null

      startTransition(() => {
        setDocument(parsedDocument)
        setSelectedJourneyId(parsedDocument.journeys[0]?.id ?? null)
        setSelectedShiftOrderId(parsedDocument.shiftOrders[0]?.id ?? null)
        setImportSource(normalizedSource)
        setActiveTab('build')
        setNotice({
          text: !shouldSaveToServer
            ? `Imported ${parsedDocument.journeys.length} journeys and ${parsedDocument.shiftOrders.length} shift orders from Luau without saving to the server.`
            : saveResult
              ? `Imported ${parsedDocument.journeys.length} journeys and ${parsedDocument.shiftOrders.length} shift orders from Luau and ${saveResult.wasExisting ? 'updated' : 'saved'} shift ${moduleName} on the server.`
              : `Imported ${parsedDocument.journeys.length} journeys and ${parsedDocument.shiftOrders.length} shift orders from Luau, but the shift could not be saved to the server.`,
          variant: !shouldSaveToServer ? 'info' : saveResult ? 'success' : 'warning',
        })
      })
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Import failed.',
        variant: 'danger',
      })
    }
  }

  function resetToBlank() {
    const blankDocument = createEmptyDocument()

    startTransition(() => {
      setDocument(blankDocument)
      setSelectedJourneyId(blankDocument.journeys[0]?.id ?? null)
      setSelectedShiftOrderId(blankDocument.shiftOrders[0]?.id ?? null)
      setImportSource('')
      setShiftModuleName('')
      setNotice({
        text: 'Reset the editor to a blank shift document.',
        variant: 'info',
      })
    })
  }

  function loadShiftFromServer(moduleName: string) {
    const savedShift = savedShifts.find((currentSavedShift) => currentSavedShift.moduleName === moduleName)
    if (!savedShift) {
      setNotice({
        text: 'Select a saved shift first.',
        variant: 'warning',
      })
      return
    }

    try {
      const parsedDocument = parseShiftModuleSource(savedShift.source)

      startTransition(() => {
        setDocument(parsedDocument)
        setSelectedJourneyId(parsedDocument.journeys[0]?.id ?? null)
        setSelectedShiftOrderId(parsedDocument.shiftOrders[0]?.id ?? null)
        setImportSource(savedShift.source)
        setShiftModuleName(savedShift.moduleName)
        setDefaultDownloadName(savedShift.moduleName)
        setActiveTab('build')
        setShowSavedShiftsModal(false)
        setNotice({
          text: `Loaded saved shift ${savedShift.moduleName} from the server.`,
          variant: 'success',
        })
      })
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : `Saved shift ${savedShift.moduleName} could not be imported.`,
        variant: 'danger',
      })
    }
  }

  async function saveShiftFromModal(moduleName: string) {
    if (liveExport.error) {
      setNotice({
        text: liveExport.error,
        variant: 'danger',
      })
      return
    }

    if (!moduleName.trim()) {
      setNotice({
        text: 'Enter a shift module name before saving.',
        variant: 'warning',
      })
      return
    }

    const wasExisting = savedShifts.some((shift) => shift.moduleName === moduleName)
    const shouldSave = await requestConfirmation(
      wasExisting
        ? `Overwrite the shift already saved on the server as module ${moduleName}?`
        : `Save the current shift to the server as module ${moduleName}?`,
      { title: 'Save shift?', confirmLabel: 'Save to server' },
    )
    if (!shouldSave) {
      return
    }

    const saveResult = await saveShiftToServer(moduleName, liveExport.source)
    if (saveResult) {
      setNotice({
        text: `${saveResult.wasExisting ? 'Updated' : 'Saved'} shift ${saveResult.moduleName} on the server.`,
        variant: 'success',
      })
    }
  }

  function loadCurrentExportIntoImporter() {
    if (liveExport.error) {
      setNotice({
        text: liveExport.error,
        variant: 'danger',
      })
      return
    }

    setImportSource(liveExport.source)
    setActiveTab('io')
    setNotice({
      text: 'Loaded the current export into the import editor.',
      variant: 'info',
    })
  }

  function importRoutesSource() {
    if (!routesSource.trim()) {
      setImportedRoutes([])
      setRoutesImportError('')
      setNotice({
        text: 'Routes source cleared.',
        variant: 'info',
      })
      return
    }

    try {
      const routes = parseRoutesModuleSource(routesSource)
      setImportedRoutes(routes)
      setRoutesImportError('')
      setNotice({
        text: `Imported ${routes.length} routes from source.`,
        variant: 'success',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import the routes module.'
      setRoutesImportError(message)
      setNotice({
        text: message,
        variant: 'danger',
      })
    }
  }

  function importPanelsSource() {
    if (!panelsSource.trim()) {
      setImportedPanels([])
      setPanelsImportError('')
      setNotice({
        text: 'Panels source cleared.',
        variant: 'info',
      })
      return
    }

    try {
      const panels = parsePanelsModuleSource(panelsSource)
      const panelTemplates = parseTemporaryPanelsModuleSource(panelsSource)
      setImportedPanels(panels)
      setImportedPanelTemplates(panelTemplates)
      setPanelsImportError('')
      setNotice({
        text: `Imported ${panels.length} panels from source.`,
        variant: 'success',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import the panels module.'
      setPanelsImportError(message)
      setNotice({
        text: message,
        variant: 'danger',
      })
    }
  }

  function importNumsSource() {
    if (!numsSource.trim()) {
      setImportedNumsCount(0)
      setImportedNumTemplates([])
      setNumsImportError('')
      setNotice({
        text: 'Nums source cleared.',
        variant: 'info',
      })
      return
    }

    try {
      const numTemplates = parseTemporaryNumsModuleSource(numsSource)
      setImportedNumsCount(numTemplates.length)
      setImportedNumTemplates(numTemplates)
      setNumsImportError('')
      setNotice({
        text: `Imported ${numTemplates.length} nums from source.`,
        variant: 'success',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import the nums module.'
      setNumsImportError(message)
      setNotice({
        text: message,
        variant: 'danger',
      })
    }
  }

  function importSoundsSource() {
    if (!soundsSource.trim()) {
      setImportedSounds([])
      setSoundsImportError('')
      setNotice({
        text: 'Sounds source cleared.',
        variant: 'info',
      })
      return
    }

    try {
      const sounds = parseSoundsModuleSource(soundsSource)
      setImportedSounds(sounds)
      setSoundsImportError('')
      setNotice({
        text: `Imported ${sounds.length} sounds from source.`,
        variant: 'success',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import the sounds module.'
      setSoundsImportError(message)
      setNotice({
        text: message,
        variant: 'danger',
      })
    }
  }

  function applyFetchedReferenceModuleSources(sources: {
    routesSource: string
    panelsSource: string
    numsSource: string
    soundsSource: string
  }) {
    setRoutesSource(sources.routesSource)
    setPanelsSource(sources.panelsSource)
    setNumsSource(sources.numsSource)
    setSoundsSource(sources.soundsSource)

    if (sources.routesSource.trim()) {
      try {
        setImportedRoutes(parseRoutesModuleSource(sources.routesSource))
        setRoutesImportError('')
      } catch (error) {
        setRoutesImportError(error instanceof Error ? error.message : 'Failed to import the routes module.')
      }
    } else {
      setImportedRoutes([])
      setRoutesImportError('')
    }

    if (sources.panelsSource.trim()) {
      try {
        setImportedPanels(parsePanelsModuleSource(sources.panelsSource))
        setImportedPanelTemplates(parseTemporaryPanelsModuleSource(sources.panelsSource))
        setPanelsImportError('')
      } catch (error) {
        setPanelsImportError(error instanceof Error ? error.message : 'Failed to import the panels module.')
      }
    } else {
      setImportedPanels([])
      setImportedPanelTemplates([])
      setPanelsImportError('')
    }

    if (sources.numsSource.trim()) {
      try {
        const numTemplates = parseTemporaryNumsModuleSource(sources.numsSource)
        setImportedNumsCount(numTemplates.length)
        setImportedNumTemplates(numTemplates)
        setNumsImportError('')
      } catch (error) {
        setNumsImportError(error instanceof Error ? error.message : 'Failed to import the nums module.')
      }
    } else {
      setImportedNumsCount(0)
      setImportedNumTemplates([])
      setNumsImportError('')
    }

    if (sources.soundsSource.trim()) {
      try {
        setImportedSounds(parseSoundsModuleSource(sources.soundsSource))
        setSoundsImportError('')
      } catch (error) {
        setSoundsImportError(error instanceof Error ? error.message : 'Failed to import the sounds module.')
      }
    } else {
      setImportedSounds([])
      setSoundsImportError('')
    }
  }

  async function syncReferenceModulesFromServer() {
    try {
      const sources = await fetchReferenceModules(token)
      applyFetchedReferenceModuleSources(sources)
      setReferenceModuleSyncError('')
      setNotice({
        text: 'Reference modules synchronised from server.',
        variant: 'success',
      })
    } catch (error) {
      setReferenceModuleSyncError(error instanceof Error ? error.message : 'Failed to synchronise reference modules.')
    }
  }

  async function saveReferenceModuleToServer(type: 'routes' | 'panels' | 'nums' | 'sounds', source: string) {
    setSavingModuleType(type)
    try {
      await saveReferenceModule(token, type, source)
      setNotice({
        text: `Saved ${type} module to server.`,
        variant: 'success',
      })
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : `Failed to save the ${type} module to the server.`,
        variant: 'danger',
      })
    } finally {
      setSavingModuleType(null)
    }
  }

  function clearRoutesSource() {
    setRoutesSource('')
    setImportedRoutes([])
    setRoutesImportError('')
    setNotice({
      text: 'Routes module data cleared.',
      variant: 'info',
    })
  }

  function clearPanelsSource() {
    setPanelsSource('')
    setImportedPanels([])
    setImportedPanelTemplates([])
    setPanelsImportError('')
    setNotice({
      text: 'Panels module data cleared.',
      variant: 'info',
    })
  }

  function clearNumsSource() {
    setNumsSource('')
    setImportedNumsCount(0)
    setImportedNumTemplates([])
    setNumsImportError('')
    setNotice({
      text: 'Nums module data cleared.',
      variant: 'info',
    })
  }

  function clearSoundsSource() {
    setSoundsSource('')
    setImportedSounds([])
    setSoundsImportError('')
    setNotice({
      text: 'Sounds module data cleared.',
      variant: 'info',
    })
  }

  function resetTemporaryDisplays() {
    setTemporaryPanelEntries([])
    setTemporaryNumEntries([])
    setNotice({
      text: 'Temporary panel and num entries cleared.',
      variant: 'info',
    })
  }

  function importTemporaryPanelById(entryId: string) {
    const currentEntry = temporaryPanelEntries.find((entry) => entry.id === entryId)
    const panelId = currentEntry?.panelId.trim() ?? ''

    if (!panelId) {
      setNotice({
        text: 'Enter a panel ID before importing existing panel values.',
        variant: 'warning',
      })
      return
    }

    const template = importedPanelTemplates.find((entry) => entry.panelId === panelId)
    if (!template) {
      setNotice({
        text: `No loaded panel template was found for ID ${panelId}.`,
        variant: 'warning',
      })
      return
    }

    setTemporaryPanelEntries((current) => current.map((entry) => (
      entry.id === entryId ? cloneTemporaryPanelEntry(template, entry.id) : entry
    )))
    setNotice({
      text: `Imported panel ${panelId} values into the temporary editor entry.`,
      variant: 'success',
    })
  }

  function importTemporaryNumById(entryId: string) {
    const currentEntry = temporaryNumEntries.find((entry) => entry.id === entryId)
    const numId = currentEntry?.numId.trim() ?? ''

    if (!numId) {
      setNotice({
        text: 'Enter a num ID before importing existing num values.',
        variant: 'warning',
      })
      return
    }

    const template = importedNumTemplates.find((entry) => entry.numId === numId)
    if (!template) {
      setNotice({
        text: `No loaded num template was found for ID ${numId}.`,
        variant: 'warning',
      })
      return
    }

    setTemporaryNumEntries((current) => current.map((entry) => (
      entry.id === entryId ? cloneTemporaryNumEntry(template, entry.id) : entry
    )))
    setNotice({
      text: `Imported num ${numId} values into the temporary editor entry.`,
      variant: 'success',
    })
  }

  function resetTemporaryRoutes() {
    setTemporaryRouteEntries([])
    setNotice({
      text: 'Temporary route entries cleared.',
      variant: 'info',
    })
  }

  return (
    <div className="app-shell" data-bs-theme="dark">
      {referenceModuleSyncError ? (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setReferenceModuleSyncError('')}
          className="sync-error-toast"
        >
          {referenceModuleSyncError}
        </Alert>
      ) : null}

      <Container fluid="xxl" className="workspace-container py-3 py-xl-4">
        <div className="workspace-toolbar mb-3">
          <ButtonGroup size="sm" className="workspace-tabs">
            <Button variant={activeTab === 'build' ? 'primary' : 'outline-secondary'} onClick={() => setActiveTab('build')}>
              Build
            </Button>
            <Button variant={activeTab === 'overview' ? 'primary' : 'outline-secondary'} onClick={() => setActiveTab('overview')}>
              Overview
            </Button>
            <Button variant={activeTab === 'io' ? 'primary' : 'outline-secondary'} onClick={() => setActiveTab('io')}>
              Import / Export
            </Button>
            <Button variant={activeTab === 'modules' ? 'primary' : 'outline-secondary'} onClick={() => setActiveTab('modules')}>
              Reference modules
            </Button>
            <Button variant={activeTab === 'displays' ? 'primary' : 'outline-secondary'} onClick={() => setActiveTab('displays')}>
              Temporary displays
            </Button>
            <Button variant={activeTab === 'routes' ? 'primary' : 'outline-secondary'} onClick={() => setActiveTab('routes')}>
              Temporary routes
            </Button>
            <Button variant={activeTab === 'publishes' ? 'primary' : 'outline-secondary'} onClick={() => setActiveTab('publishes')}>
              Publishes
            </Button>
          </ButtonGroup>

          <UserMenu>
            <Dropdown.Item onClick={() => setShowIntegrityConfigModal(true)}>
              Integrity{integrityWarnings.length > 0 ? ` (${integrityWarnings.length})` : ''}
            </Dropdown.Item>
            <Dropdown.Item onClick={resetToBlank}>
              Reset blank
            </Dropdown.Item>
            <Dropdown.Item onClick={syncReferenceModulesFromServer}>
              Synchronise reference modules
            </Dropdown.Item>
          </UserMenu>

          <div className="workspace-toolbar__stats">
            <Badge bg={exportReady ? 'success' : 'warning'} text={exportReady ? undefined : 'dark'} pill>
              {exportReady ? 'Ready' : `${validationCount} issue${validationCount === 1 ? '' : 's'}`}
            </Badge>
            {hasEnabledIntegrityRanges || integrityWarnings.length > 0 || integrityConfigIssue ? (
              <Badge bg={integrityWarnings.length > 0 || integrityConfigIssue ? 'warning' : 'secondary'} text={integrityWarnings.length > 0 || integrityConfigIssue ? 'dark' : undefined} pill>
                {integrityConfigIssue
                  ? 'Integrity config issue'
                  : `${integrityWarnings.length} integrity warning${integrityWarnings.length === 1 ? '' : 's'}`}
              </Badge>
            ) : null}
            <Badge bg="secondary" pill>{journeyCount} journeys</Badge>
            <Badge bg="secondary" pill>{shiftOrderCount} orders</Badge>
            <Badge bg="secondary" pill>{planNodeCount} nodes</Badge>
            <Badge bg="secondary" pill>{importedRoutes.length} routes</Badge>
            <Badge bg="secondary" pill>{importedPanels.length} panels</Badge>
            <Badge bg="secondary" pill>{importedNumsCount} nums</Badge>
            <Badge bg="secondary" pill>{importedSounds.length} sounds</Badge>
            {temporaryPanelEntries.length > 0 || temporaryNumEntries.length > 0 ? (
              <Badge bg="secondary" pill>{temporaryPanelEntries.length + temporaryNumEntries.length} temp entries</Badge>
            ) : null}
            {temporaryRouteEntries.length > 0 ? (
              <Badge bg="secondary" pill>{temporaryRouteEntries.length} temp routes</Badge>
            ) : null}
            <Badge bg="secondary" pill>{savedShifts.length} saved shifts</Badge>
            <span className={`toolbar-note toolbar-note--${notice.variant}`}>{notice.text}</span>
          </div>
        </div>

        {integrityConfigIssue ? (
          <Alert variant="warning" className="mb-3 compact-alert">
            Integrity configuration needs review: {integrityConfigIssue}
          </Alert>
        ) : null}

        {integrityWarnings.length > 0 ? (
          <Alert variant="warning" className="mb-3 compact-alert">
            <div className="panel-toolbar panel-toolbar--dense mb-2">
              <div className="panel-label">Integrity warnings</div>
              <Badge bg="warning" text="dark" pill>{integrityWarnings.length}</Badge>
            </div>

            <div className="integrity-warning-list">
              {visibleIntegrityWarnings.map((warning) => (
                <div className="integrity-warning-item" key={warning.id}>
                  <div className="integrity-warning-item__title">{warning.title}</div>
                  <div className="integrity-warning-item__detail">{warning.description}</div>
                </div>
              ))}
            </div>

            {remainingIntegrityWarnings > 0 ? (
              <div className="toolbar-note toolbar-note--warning mt-2">
                And {remainingIntegrityWarnings} more integrity warning{remainingIntegrityWarnings === 1 ? '' : 's'}.
              </div>
            ) : null}
          </Alert>
        ) : null}

        {activeTab === 'build' ? (
          <Stack gap={3}>
            <JourneyEditorPanel
              onAppendSubstituteServicePlan={appendPlannedSubstituteService}
              importedPanels={importedPanels}
              importedRoutes={importedRoutes}
              importedSounds={importedSounds}
              journeys={document.journeys}
              selectedJourneyId={selectedJourneyId}
              shiftOrders={document.shiftOrders}
              onAddJourney={addJourney}
              onDuplicateJourney={duplicateJourney}
              onRemoveJourney={removeJourney}
              onSelectJourney={setSelectedJourneyId}
              onUpdateJourney={updateJourney}
            />

            <ShiftOrdersPanel
              importedPanels={importedPanels}
              importedRoutes={importedRoutes}
              journeys={document.journeys}
              selectedShiftOrderId={selectedShiftOrderId}
              shiftOrders={document.shiftOrders}
              onAddShiftOrder={addShiftOrder}
              onCloneOrderSeries={cloneOrderSeries}
              onDeleteShiftOrder={deleteShiftOrder}
              onSelectShiftOrder={setSelectedShiftOrderId}
              onUpdateShiftOrder={updateShiftOrder}
            />
          </Stack>
        ) : null}

        {activeTab === 'overview' ? (
          <OperationsOverviewTab
            documents={overviewDocuments}
            importedRoutes={importedRoutes}
          />
        ) : null}

        {activeTab === 'io' ? (
          <ImportExportTab
            downloadName={downloadName}
            exportBlocked={validation.errors.length > 0 || Boolean(liveExport.error)}
            exportError={liveExport.error}
            importSource={importSource}
            moduleName={shiftModuleName}
            previewSource={previewExport.error ? '' : previewExport.source}
            savedShiftsCount={savedShifts.length}
            validationErrors={validation.errors}
            onChangeDownloadName={setDownloadName}
            onChangeImportSource={setImportSource}
            onChangeModuleName={setShiftModuleName}
            onClearImportSource={() => setImportSource('')}
            onCopyExport={copyExport}
            onDownloadExport={downloadExport}
            onImportSource={importFromSource}
            onLoadIntoImport={loadCurrentExportIntoImporter}
            onOpenLiveUpdate={() => setShowLiveShiftUpdateModal(true)}
            onOpenBrowseShifts={() => {
              setSavedShiftsModalMode('browse')
              setShowSavedShiftsModal(true)
            }}
            onOpenSaveShift={() => {
              setSavedShiftsModalMode('save')
              setShowSavedShiftsModal(true)
            }}
          />
        ) : null}

        {activeTab === 'modules' ? (
          <ModuleSourcesTab
            importedNumsCount={importedNumsCount}
            importedPanelsCount={importedPanels.length}
            importedRoutesCount={importedRoutes.length}
            importedSoundsCount={importedSounds.length}
            numsError={numsImportError}
            numsSource={numsSource}
            panelsError={panelsImportError}
            panelsSource={panelsSource}
            routesError={routesImportError}
            routesSource={routesSource}
            soundsError={soundsImportError}
            soundsSource={soundsSource}
            onChangeNumsSource={setNumsSource}
            onChangePanelsSource={setPanelsSource}
            onChangeRoutesSource={setRoutesSource}
            onChangeSoundsSource={setSoundsSource}
            onClearNumsSource={clearNumsSource}
            onClearPanelsSource={clearPanelsSource}
            onClearRoutesSource={clearRoutesSource}
            onClearSoundsSource={clearSoundsSource}
            onImportNums={importNumsSource}
            onImportPanels={importPanelsSource}
            onImportRoutes={importRoutesSource}
            onImportSounds={importSoundsSource}
            canSaveToServer={rank === 'admin'}
            savingModuleType={savingModuleType}
            onSaveNumsToServer={() => saveReferenceModuleToServer('nums', numsSource)}
            onSavePanelsToServer={() => saveReferenceModuleToServer('panels', panelsSource)}
            onSaveRoutesToServer={() => saveReferenceModuleToServer('routes', routesSource)}
            onSaveSoundsToServer={() => saveReferenceModuleToServer('sounds', soundsSource)}
          />
        ) : null}

        {activeTab === 'displays' ? (
          <TemporaryDisplaysTab
            hasImportedNumTemplates={importedNumTemplates.length > 0}
            hasImportedPanelTemplates={importedPanelTemplates.length > 0}
            liveUpdateError={temporaryDisplayUpdatePreview.error}
            liveUpdateReady={Boolean(temporaryDisplayUpdatePreview.source)}
            numEntries={temporaryNumEntries}
            panelEntries={temporaryPanelEntries}
            onImportNumById={importTemporaryNumById}
            onImportPanelById={importTemporaryPanelById}
            onChangeNumEntries={setTemporaryNumEntries}
            onChangePanelEntries={setTemporaryPanelEntries}
            onClearAll={resetTemporaryDisplays}
            onOpenLiveUpdate={() => setShowLiveDisplayUpdateModal(true)}
          />
        ) : null}

        {activeTab === 'routes' ? (
          <TemporaryRoutesTab
            liveUpdateError={temporaryRouteUpdatePreview.error}
            liveUpdateReady={Boolean(temporaryRouteUpdatePreview.source)}
            routeEntries={temporaryRouteEntries}
            onChangeRouteEntries={setTemporaryRouteEntries}
            onClearAll={resetTemporaryRoutes}
            onOpenLiveUpdate={() => setShowLiveRouteUpdateModal(true)}
          />
        ) : null}

        {activeTab === 'publishes' ? (
          <PublishesTab
            creatingRequest={creatingPublishRequest}
            currentUsername={username}
            isAdmin={rank === 'admin'}
            requests={publishRequests}
            updatingRequestId={updatingPublishRequestId}
            onCreateRequest={createPublishRequestOnServer}
            onDeleteRequest={deletePublishRequestFromServer}
            onSetStatus={updatePublishRequestStatus}
          />
        ) : null}

        <IntegrityConfigModal
          config={integrityConfig}
          show={showIntegrityConfigModal}
          warningCount={integrityWarnings.length}
          onClose={() => setShowIntegrityConfigModal(false)}
          onSave={(nextConfig) => {
            setIntegrityConfig(nextConfig)
            setShowIntegrityConfigModal(false)
          }}
        />

        <SavedShiftsModal
          canSaveCurrent={!liveExport.error}
          currentModuleName={shiftModuleName}
          savingModuleName={savingShiftModuleName}
          shifts={savedShifts}
          mode={savedShiftsModalMode}
          show={showSavedShiftsModal}
          onClose={() => setShowSavedShiftsModal(false)}
          onLoad={loadShiftFromServer}
          onSave={saveShiftFromModal}
        />

        <ConfirmModal
          confirmLabel={confirmDialog?.confirmLabel}
          message={confirmDialog?.message ?? ''}
          show={confirmDialog !== null}
          title={confirmDialog?.title}
          onCancel={() => resolveConfirmDialog(false)}
          onConfirm={() => resolveConfirmDialog(true)}
        />

        <LiveShiftUpdateModal
          defaultLine={shiftModuleName}
          shiftSource={liveExport.source}
          show={showLiveShiftUpdateModal}
          onClose={() => setShowLiveShiftUpdateModal(false)}
        />

        <LiveDisplayUpdateModal
          error={temporaryDisplayUpdatePreview.error}
          show={showLiveDisplayUpdateModal}
          source={temporaryDisplayUpdatePreview.source}
          onClose={() => setShowLiveDisplayUpdateModal(false)}
        />

        <LiveRouteUpdateModal
          error={temporaryRouteUpdatePreview.error}
          show={showLiveRouteUpdateModal}
          source={temporaryRouteUpdatePreview.source}
          onClose={() => setShowLiveRouteUpdateModal(false)}
        />
      </Container>
    </div>
  )
}

export default App