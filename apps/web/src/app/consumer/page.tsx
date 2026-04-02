'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser, SignInButton } from '@clerk/nextjs'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Sale {
  id: string
  business_name: string
  cuisine_type?: string
  distance_m?: number
  prizes: Array<{ label: string; discount_percent?: number }>
  ends_at: string
  lat: number
  lng: number
}

export default function ConsumerPage() {
  const { isSignedIn, user } = useUser()
  const [sales, setSales] = useState<Sale[]>([])
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState<string | null>(null)
  const [spinResult, setSpinResult] = useState<{ prize: string; saleId: string } | null>(null)

  // Get browser geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported')
      setLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setLocationError('Allow location to see nearby sales')
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // Fetch nearby sales when location is available
  useEffect(() => {
    if (!location) return
    setLoading(true)
    fetch(`${API_URL}/sales/nearby?lat=${location.lat}&lng=${location.lng}&radius=5000`)
      .then((r) => r.json())
      .then((data) => {
        setSales(Array.isArray(data) ? data : data.sales || [])
      })
      .catch(() => setSales([]))
      .finally(() => setLoading(false))
  }, [location])

  function timeLeft(endsAt: string) {
    const ms = new Date(endsAt).getTime() - Date.now()
    if (ms <= 0) return 'Ended'
    const mins = Math.floor(ms / 60000)
    if (mins < 60) return `${mins}m left`
    return `${Math.floor(mins / 60)}h ${mins % 60}m left`
  }

  function handleSpin(saleId: string) {
    if (!isSignedIn) return
    setSpinning(saleId)
    setSpinResult(null)
    fetch(`${API_URL}/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sale_id: saleId,
        user_id: user?.id,
        lat: location?.lat,
        lng: location?.lng,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        setSpinResult({ prize: data.prize?.label || 'You won!', saleId })
      })
      .catch(() => {
        setSpinResult({ prize: 'Spin failed — try again', saleId })
      })
      .finally(() => setSpinning(null))
  }

  return (
    <main className="min-h-screen bg-night">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <Link href="/" className="flex items-baseline gap-0.5">
          <span className="font-display text-xl font-black text-btc">S</span>
          <span className="font-display text-xl font-black text-surface">erendip</span>
          <span className="font-display text-xl font-black text-btc/40">Eatery</span>
        </Link>
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <Link href="/dashboard" className="text-sm text-surface/60 hover:text-surface transition">
              Dashboard
            </Link>
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="text-sm text-surface/60 hover:text-surface transition">
                  Sign In
                </button>
              </SignInButton>
              <Link
                href="/sign-up"
                className="bg-btc text-night text-sm font-bold px-4 py-2 rounded-full hover:bg-btc-dark transition"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pb-16">
        {/* Location status */}
        {locationError && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">📍</div>
            <p className="text-surface/60 text-lg">{locationError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-btc text-sm hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !locationError && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4 animate-pulse">📡</div>
            <p className="text-surface/50">Finding sales near you...</p>
          </div>
        )}

        {/* Sales grid */}
        {!loading && !locationError && (
          <>
            <h1 className="text-2xl font-bold text-surface mb-2">
              {sales.length > 0 ? 'Flash sales near you' : 'No active sales nearby'}
            </h1>
            {sales.length === 0 && (
              <p className="text-surface/40 mb-8">Check back soon — sales pop up throughout the day.</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  className="rounded-2xl p-5"
                  style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.15)' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-surface text-lg">{sale.business_name}</h3>
                      {sale.cuisine_type && (
                        <span className="text-surface/40 text-xs">{sale.cuisine_type}</span>
                      )}
                    </div>
                    <span className="text-btc text-xs font-bold whitespace-nowrap">
                      {timeLeft(sale.ends_at)}
                    </span>
                  </div>

                  {sale.distance_m != null && (
                    <p className="text-surface/40 text-sm mb-3">
                      {sale.distance_m < 1000
                        ? `${Math.round(sale.distance_m)}m away`
                        : `${(sale.distance_m / 1000).toFixed(1)}km away`}
                    </p>
                  )}

                  {/* Prizes preview */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {sale.prizes?.slice(0, 3).map((p, i) => (
                      <span
                        key={i}
                        className="text-xs rounded-full px-3 py-1"
                        style={{ background: 'rgba(247,148,29,0.12)', color: '#F7941D' }}
                      >
                        {p.label}
                      </span>
                    ))}
                  </div>

                  {/* Spin button */}
                  {spinResult?.saleId === sale.id ? (
                    <div className="text-center py-3 rounded-full font-bold text-sm"
                      style={{ background: 'rgba(29,158,117,0.15)', color: '#1D9E75' }}>
                      {spinResult.prize}
                    </div>
                  ) : isSignedIn ? (
                    <button
                      onClick={() => handleSpin(sale.id)}
                      disabled={spinning === sale.id}
                      className="w-full bg-btc text-night font-bold py-3 rounded-full text-sm hover:bg-btc-dark transition disabled:opacity-50"
                    >
                      {spinning === sale.id ? 'Spinning...' : 'Spin the Wheel'}
                    </button>
                  ) : (
                    <SignInButton mode="modal">
                      <button className="w-full bg-btc text-night font-bold py-3 rounded-full text-sm hover:bg-btc-dark transition">
                        Sign in to Spin
                      </button>
                    </SignInButton>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
