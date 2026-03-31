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

export function useApi() {
  const { getToken } = useAuth()

  const getAuthToken = useCallback(async () => {
    return getToken() ?? null
  }, [getToken])

  return useMemo(() => ({
    async myBusinesses() {
      const token = await getAuthToken()
      return request<any[]>('GET', '/businesses/mine', token)
    },
    async getBusiness(id: string) {
      const token = await getAuthToken()
      return request<any>('GET', `/businesses/${id}`, token)
    },
    async updateBusiness(id: string, data: Record<string, unknown>) {
      const token = await getAuthToken()
      return request<any>('PATCH', `/businesses/${id}`, token, data)
    },
    async createBusiness(data: Record<string, unknown>) {
      const token = await getAuthToken()
      return request<any>('POST', '/businesses', token, data)
    },
    async businessSales(businessId: string) {
      const token = await getAuthToken()
      return request<any[]>('GET', `/businesses/${businessId}/sales`, token)
    },
    async getSale(id: string) {
      const token = await getAuthToken()
      return request<any>('GET', `/sales/${id}`, token)
    },
    async createSale(data: Record<string, unknown>) {
      const token = await getAuthToken()
      return request<any>('POST', '/sales', token, data)
    },
    async updateSaleStatus(saleId: string, status: string) {
      const token = await getAuthToken()
      return request<any>('PATCH', `/sales/${saleId}/status`, token, { status })
    },
    async truckPing(businessId: string, saleId: string, lat: number, lng: number) {
      const token = await getAuthToken()
      return request<any>('POST', '/visits/truck-ping', token, { businessId, saleId, lat, lng })
    },
  }), [getAuthToken])
}
