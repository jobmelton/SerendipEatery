import { useAuth } from '@clerk/clerk-expo'
import { useCallback, useMemo } from 'react'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

async function request<T>(
  method: Method,
  path: string,
  token: string | null,
  body?: Record<string, unknown>,
  query?: Record<string, string | number>,
): Promise<T> {
  let url = `${API_URL}${path}`
  if (query) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) params.set(k, String(v))
    url += `?${params.toString()}`
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json()
  if (!json.ok) {
    throw new ApiError(json.error ?? 'Request failed', json.code ?? 'UNKNOWN', res.status)
  }
  return json.data as T
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Hook that returns an API client with Clerk Bearer token automatically attached.
 */
export function useApi() {
  const { getToken } = useAuth()

  const getAuthToken = useCallback(async () => {
    return getToken() ?? null
  }, [getToken])

  return useMemo(() => ({
    // ─── Sales ──────────────────────────────────────────────────────
    async salesNearby(lat: number, lng: number, radiusKm = 5) {
      const token = await getAuthToken()
      return request<any[]>('GET', '/sales/nearby', token, undefined, { lat, lng, radius_km: radiusKm })
    },

    async getSale(id: string) {
      const token = await getAuthToken()
      return request<any>('GET', `/sales/${id}`, token)
    },

    // ─── Spin ───────────────────────────────────────────────────────
    async spin(saleId: string, spinLat: number, spinLng: number) {
      const token = await getAuthToken()
      return request<{
        prizeId: string
        prizeName: string
        prizeType: string
        prizeValue: number
        code: string
        expiresAt: string
        pointsEarned: number
        visitIntentId: string
        animationSeed: number
        updatedPrizeCounts: Array<{ prizeId: string; spinsUsed: number; maxSpins: number }>
      }>('POST', '/spin', token, { saleId, spinLat, spinLng })
    },

    // ─── Visits ─────────────────────────────────────────────────────
    async checkin(visitIntentId: string, lat: number, lng: number) {
      const token = await getAuthToken()
      return request<any>('POST', '/visits/checkin', token, { visitIntentId, lat, lng })
    },

    async myVisits() {
      const token = await getAuthToken()
      return request<any[]>('GET', '/visits/mine', token)
    },

    // ─── Users ──────────────────────────────────────────────────────
    async me() {
      const token = await getAuthToken()
      return request<any>('GET', '/users/me', token)
    },

    async myStats() {
      const token = await getAuthToken()
      return request<any>('GET', '/users/me/stats', token)
    },
  }), [getAuthToken])
}
