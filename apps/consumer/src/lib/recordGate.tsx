import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@clerk/clerk-expo'
import { useApi } from './api'

export type RecordGate = {
  attempt: any | null
  participant: any | null
  currentMatch: any | null
  unlocked: boolean
  lockReason: string
  showUnlockCta: boolean
}

const DEFAULT_UNLOCKED: RecordGate = {
  attempt: null,
  participant: null,
  currentMatch: null,
  unlocked: true,
  lockReason: 'no_attempt',
  showUnlockCta: false,
}

const Ctx = createContext<{
  gate: RecordGate
  loading: boolean
  refresh: () => Promise<void>
}>({
  gate: DEFAULT_UNLOCKED,
  loading: true,
  refresh: async () => {},
})

export function RecordGateProvider({ children }: { children: ReactNode }) {
  const api = useApi()
  const { isSignedIn } = useAuth()
  const [gate, setGate] = useState<RecordGate>(DEFAULT_UNLOCKED)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setGate(DEFAULT_UNLOCKED)
      setLoading(false)
      return
    }
    try {
      const data = await api.recordGate()
      setGate(data)
    } catch {
      setGate(DEFAULT_UNLOCKED)
    } finally {
      setLoading(false)
    }
  }, [api, isSignedIn])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (gate.unlocked) return
    const iv = setInterval(refresh, 30_000)
    return () => clearInterval(iv)
  }, [gate.unlocked, refresh])

  return <Ctx.Provider value={{ gate, loading, refresh }}>{children}</Ctx.Provider>
}

export function useRecordGate() {
  return useContext(Ctx)
}
