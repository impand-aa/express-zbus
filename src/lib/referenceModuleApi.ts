import { parseJsonResponse } from './authApi'

export type ReferenceModuleSources = {
  routesSource: string
  panelsSource: string
  numsSource: string
  soundsSource: string
}

export type ReferenceModuleType = 'routes' | 'panels' | 'nums' | 'sounds'

export async function fetchReferenceModules(token: string): Promise<ReferenceModuleSources> {
  const response = await fetch('/api/reference-modules', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseJsonResponse(response)
}

export async function saveReferenceModule(token: string, type: ReferenceModuleType, source: string): Promise<void> {
  const response = await fetch('/api/reference-modules', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type, source }),
  })
  await parseJsonResponse(response)
}
