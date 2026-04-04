'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function RedeemPage() {
  const { walletId } = useParams<{ walletId: string }>()
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'countdown' | 'confirmed' | 'expired' | 'error'>('loading')
  const [prize, setPrize] = useState({ name: '', business: '' })
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [timeLeft, setTimeLeft] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start redeem window
  useEffect(() => {
    fetch(`${API_URL}/wallets/${walletId}/start-redeem`, { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setState('error'); return }
        setPrize({ name: d.data.prizeName, business: d.data.businessName })
        setExpiresAt(new Date(d.data.expiresAt))
        setState('countdown')
      })
      .catch(() => setState('error'))
  }, [walletId])

  // Countdown timer
  useEffect(() => {
    if (state !== 'countdown' || !expiresAt) return

    const tick = () => {
      const diff = expiresAt.getTime() - Date.now()
      if (diff <= 0) {
        setState('expired')
        if (timerRef.current) clearInterval(timerRef.current)
        return
      }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
      setSecondsLeft(Math.floor(diff / 1000))
    }

    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [state, expiresAt])

  const handleConfirm = async () => {
    const res = await fetch(`${API_URL}/wallets/${walletId}/confirm-redeem`, { method: 'POST' })
    const d = await res.json()
    if (d.ok) setState('confirmed')
    else setState('error')
  }

  const handleCancel = async () => {
    await fetch(`${API_URL}/wallets/${walletId}/cancel-redeem`, { method: 'POST' })
    router.push('/lootbox')
  }

  // Progress circle
  const totalSeconds = 15 * 60 // assume 15 min default
  const progress = Math.max(0, secondsLeft / totalSeconds)

  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
      {state === 'loading' && (
        <p className="text-surface/30 animate-pulse">Starting redemption...</p>
      )}

      {state === 'countdown' && (
        <div className="text-center max-w-sm">
          {/* Pulsing green circle */}
          <div className="relative w-48 h-48 mx-auto mb-8">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(29,158,117,0.1)" strokeWidth="6" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="#1D9E75" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${progress * 276.46} 276.46`}
                transform="rotate(-90 50 50)"
                className="animate-[pulse_2s_ease-in-out_infinite]"
                style={{ transition: 'stroke-dasharray 1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-black text-teal">{timeLeft}</span>
            </div>
          </div>

          <h1 className="text-2xl font-black text-surface mb-1">{prize.name}</h1>
          <p className="text-surface/40 mb-6">{prize.business}</p>

          <p className="text-surface/50 text-sm mb-8">Show this to staff and tap confirm when ready</p>

          <button onClick={handleConfirm}
            className="w-full bg-teal text-night font-bold py-4 rounded-xl text-lg hover:bg-teal/90 transition mb-3">
            Confirm Redemption
          </button>

          <p className="text-red-400/50 text-xs mb-4">Once confirmed this deal is gone forever</p>

          <button onClick={handleCancel} className="text-surface/30 text-sm hover:text-surface/50 transition">
            Cancel — return to lootbox
          </button>
        </div>
      )}

      {state === 'confirmed' && (
        <div className="text-center">
          <p className="text-5xl mb-4">✅</p>
          <h1 className="text-2xl font-black text-teal mb-2">Redeemed!</h1>
          <p className="text-surface/40 mb-6">{prize.name} at {prize.business}</p>
          <Link href="/lootbox" className="text-btc text-sm hover:underline">Back to Lootbox</Link>
        </div>
      )}

      {state === 'expired' && (
        <div className="text-center">
          <p className="text-5xl mb-4">⏰</p>
          <h1 className="text-2xl font-black text-red-400 mb-2">This deal has expired</h1>
          <p className="text-surface/40 mb-6">The redemption window closed before confirmation.</p>
          <Link href="/lootbox" className="text-btc text-sm hover:underline">Back to Lootbox</Link>
        </div>
      )}

      {state === 'error' && (
        <div className="text-center">
          <p className="text-red-400 font-bold mb-4">Something went wrong</p>
          <Link href="/lootbox" className="text-btc text-sm hover:underline">Back to Lootbox</Link>
        </div>
      )}
    </main>
  )
}
