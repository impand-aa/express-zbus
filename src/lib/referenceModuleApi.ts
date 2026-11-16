import { organizationApiUrl, parseJsonResponse, type OrganizationRequestContext } from './authApi'

export type ReferenceModuleSources = {
  routesSource: string
  panelsSource: string
  numsSource: string
  soundsSource: string
}

export type ReferenceModuleType = 'routes' | 'panels' | 'nums' | 'sounds'

export async function fetchReferenceModules(context: OrganizationRequestContext): Promise<ReferenceModuleSources> {
  const response = await fetch(organizationApiUrl(context, '/reference-modules'), {
    headers: { Authorization: `Bearer ${context.token}` },
  })
  return parseJsonResponse(response)
}

export async function saveReferenceModule(context: OrganizationRequestContext, type: ReferenceModuleType, source: string): Promise<void> {
  const response = await fetch(organizationApiUrl(context, '/reference-modules'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${context.token}`,
    },
    body: JSON.stringify({ type, source }),
  })
  await parseJsonResponse(response)
}
