import { organizationApiUrl, parseJsonResponse, type OrganizationRequestContext } from './authApi'

export type ShiftRecord = {
  moduleName: string
  source: string
  updatedBy: string
  updatedAt: string
}

export function upsertShiftRecord(shifts: ShiftRecord[], shift: ShiftRecord): ShiftRecord[] {
  return [...shifts.filter((existing) => existing.moduleName !== shift.moduleName), shift]
}

export async function fetchAllShifts(context: OrganizationRequestContext): Promise<ShiftRecord[]> {
  const response = await fetch(organizationApiUrl(context, '/shifts'), {
    headers: { Authorization: `Bearer ${context.token}` },
  })
  return parseJsonResponse(response)
}

export async function fetchShift(context: OrganizationRequestContext, moduleName: string): Promise<ShiftRecord> {
  const response = await fetch(organizationApiUrl(context, `/shifts/${encodeURIComponent(moduleName)}`), {
    headers: { Authorization: `Bearer ${context.token}` },
  })
  return parseJsonResponse(response)
}

export async function saveShift(context: OrganizationRequestContext, moduleName: string, source: string): Promise<ShiftRecord> {
  const response = await fetch(organizationApiUrl(context, `/shifts/${encodeURIComponent(moduleName)}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${context.token}`,
    },
    body: JSON.stringify({ source }),
  })
  return parseJsonResponse(response)
}
