import { parseJsonResponse } from './authApi'

export type ShiftRecord = {
  moduleName: string
  source: string
  updatedBy: string
  updatedAt: string
}

export function upsertShiftRecord(shifts: ShiftRecord[], shift: ShiftRecord): ShiftRecord[] {
  return [...shifts.filter((existing) => existing.moduleName !== shift.moduleName), shift]
}

export async function fetchAllShifts(token: string): Promise<ShiftRecord[]> {
  const response = await fetch('/api/shifts', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseJsonResponse(response)
}

export async function fetchShift(token: string, moduleName: string): Promise<ShiftRecord> {
  const response = await fetch(`/api/shifts/${encodeURIComponent(moduleName)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseJsonResponse(response)
}

export async function saveShift(token: string, moduleName: string, source: string): Promise<ShiftRecord> {
  const response = await fetch(`/api/shifts/${encodeURIComponent(moduleName)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ source }),
  })
  return parseJsonResponse(response)
}
