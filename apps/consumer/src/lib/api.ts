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

    // ─── Referrals ──────────────────────────────────────────────────
    async myReferralCodes() {
      const token = await getAuthToken()
      return request<{ userCode: string | null; bizCode: string | null; referrals: any[] }>('GET', '/referrals/my-code', token)
    },

    async redeemReferral(code: string) {
      const token = await getAuthToken()
      return request<any>('POST', '/referrals/redeem', token, { code })
    },

    async referralStats() {
      const token = await getAuthToken()
      return request<any>('GET', '/referrals/stats', token)
    },

    // ─── Share Cards ────────────────────────────────────────────────
    async getShareCard(visitIntentId: string) {
      const token = await getAuthToken()
      return request<{ imageUrl: string }>('GET', `/share/win/${visitIntentId}`, token)
    },

    async getProfileCard(userId: string) {
      const token = await getAuthToken()
      return request<{ imageUrl: string }>('GET', `/share/profile/${userId}`, token)
    },

    // ─── Battles ────────────────────────────────────────────────────
    async battlesNearby(lat: number, lng: number, radius = 500) {
      const token = await getAuthToken()
      return request<any[]>('GET', '/battles/nearby', token, undefined, { lat, lng, radius })
    },

    async challengeUser(defenderId: string, lat?: number, lng?: number) {
      const token = await getAuthToken()
      return request<any>('POST', '/battles/challenge', token, { defenderId, lat, lng })
    },

    async acceptBattle(battleId: string) {
      const token = await getAuthToken()
      return request<any>('POST', `/battles/${battleId}/accept`, token)
    },

    async declineBattle(battleId: string) {
      const token = await getAuthToken()
      return request<any>('POST', `/battles/${battleId}/decline`, token)
    },

    async submitMoves(battleId: string, moves: string[]) {
      const token = await getAuthToken()
      return request<any>('POST', `/battles/${battleId}/moves`, token, { moves })
    },

    async getBattle(battleId: string) {
      const token = await getAuthToken()
      return request<any>('GET', `/battles/${battleId}`, token)
    },

    async claimLoot(battleId: string, lootType: 'points' | 'coupon') {
      const token = await getAuthToken()
      return request<any>('POST', `/battles/${battleId}/loot`, token, { lootType })
    },
  }), [getAuthToken])
}
