import { organizationApiUrl, parseJsonResponse, type OrganizationRequestContext } from './authApi'

export type PublishRequestType = 'shift' | 'route' | 'panel'
export type PublishRequestStatus = 'pending' | 'complete'

export type PublishRequestRecord = {
  id: string
  type: PublishRequestType
  objectId: string | null
  description: string
  data: string
  requester: string
  updatedAt: string
  status: PublishRequestStatus
}

export async function fetchPublishRequests(context: OrganizationRequestContext): Promise<PublishRequestRecord[]> {
  const response = await fetch(organizationApiUrl(context, '/publish-requests'), {
    headers: { Authorization: `Bearer ${context.token}` },
  })
  return parseJsonResponse(response)
}

export async function createPublishRequest(
  context: OrganizationRequestContext,
  request: { type: PublishRequestType; objectId: string | null; description: string; data: string },
): Promise<PublishRequestRecord> {
  const response = await fetch(organizationApiUrl(context, '/publish-requests'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${context.token}`,
    },
    body: JSON.stringify(request),
  })
  return parseJsonResponse(response)
}

export async function setPublishRequestStatus(
  context: OrganizationRequestContext,
  id: string,
  status: PublishRequestStatus,
): Promise<PublishRequestRecord> {
  const response = await fetch(organizationApiUrl(context, `/publish-requests/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${context.token}`,
    },
    body: JSON.stringify({ status }),
  })
  return parseJsonResponse(response)
}

export async function deletePublishRequest(context: OrganizationRequestContext, id: string): Promise<void> {
  const response = await fetch(organizationApiUrl(context, `/publish-requests/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${context.token}` },
  })
  await parseJsonResponse(response)
}
