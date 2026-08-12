import { parseJsonResponse } from './authApi'

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

export async function fetchPublishRequests(token: string): Promise<PublishRequestRecord[]> {
  const response = await fetch('/api/publish-requests', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseJsonResponse(response)
}

export async function createPublishRequest(
  token: string,
  request: { type: PublishRequestType; objectId: string | null; description: string; data: string },
): Promise<PublishRequestRecord> {
  const response = await fetch('/api/publish-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  })
  return parseJsonResponse(response)
}

export async function setPublishRequestStatus(
  token: string,
  id: string,
  status: PublishRequestStatus,
): Promise<PublishRequestRecord> {
  const response = await fetch(`/api/publish-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  })
  return parseJsonResponse(response)
}

export async function deletePublishRequest(token: string, id: string): Promise<void> {
  const response = await fetch(`/api/publish-requests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  await parseJsonResponse(response)
}
