'use client'

import { useState, useEffect, useRef } from 'react'
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

/* ─── Spin Wheel Component ─── */
const SEGMENT_COLORS = ['#F7941D', '#1a0e00']
const NUM_SEGMENTS = 8

function SpinWheel({
  prizes,
  onSpinComplete,
  spinning,
}: {
  prizes: Array<{ label: string }>
  onSpinComplete: () => void
  spinning: boolean
}) {
  const [rotation, setRotation] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const wheelRef = useRef<SVGSVGElement>(null)

  // Pad or trim prizes to fill 8 segments
  const segments = Array.from({ length: NUM_SEGMENTS }, (_, i) => {
    const prize = prizes[i % prizes.length]
    return prize?.label || '🎉'
  })

  useEffect(() => {
    if (spinning && !isAnimating) {
      setIsAnimating(true)
      // Spin 5-8 full rotations + random offset
      const extraRotations = (5 + Math.random() * 3) * 360
      const newRotation = rotation + extraRotations
      setRotation(newRotation)

      setTimeout(() => {
        setIsAnimating(false)
        onSpinComplete()
      }, 4000)
    }
  }, [spinning])

  const segmentAngle = 360 / NUM_SEGMENTS
  const radius = 120
  const center = 140

  function polarToCartesian(angle: number, r: number) {
    const rad = ((angle - 90) * Math.PI) / 180
    return { x: center + r * Math.cos(rad), y: center + r * Math.sin(rad) }
  }

  function segmentPath(index: number) {
    const startAngle = index * segmentAngle
    const endAngle = startAngle + segmentAngle
    const start = polarToCartesian(startAngle, radius)
    const end = polarToCartesian(endAngle, radius)
    const largeArc = segmentAngle > 180 ? 1 : 0
    return `M${center},${center} L${start.x},${start.y} A${radius},${radius} 0 ${largeArc} 1 ${end.x},${end.y} Z`
  }

  function labelPosition(index: number) {
    const midAngle = index * segmentAngle + segmentAngle / 2
    const r = radius * 0.65
    return polarToCartesian(midAngle, r)
  }

  return (
    <div className="relative flex items-center justify-center my-4">
      {/* Pointer arrow at top */}
      <div
        className="absolute -top-1 z-10"
        style={{
          width: 0,
          height: 0,
          borderLeft: '12px solid transparent',
          borderRight: '12px solid transparent',
          borderTop: '20px solid #FFD700',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
        }}
      />

      <svg
        ref={wheelRef}
        viewBox="0 0 280 280"
        width="260"
        height="260"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: isAnimating
            ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
            : 'none',
        }}
      >
        {/* Outer ring */}
        <circle cx={center} cy={center} r={radius + 8} fill="none" stroke="#F7941D" strokeWidth="3" opacity="0.4" />
        <circle cx={center} cy={center} r={radius + 2} fill="none" stroke="#F7941D" strokeWidth="1" opacity="0.2" />

        {/* Segments */}
        {segments.map((label, i) => (
          <g key={i}>
            <path
              d={segmentPath(i)}
              fill={SEGMENT_COLORS[i % 2]}
              stroke="#2a1800"
              strokeWidth="1"
            />
            <text
              x={labelPosition(i).x}
              y={labelPosition(i).y}
              fill={i % 2 === 0 ? '#1a0e00' : '#F7941D'}
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${i * segmentAngle + segmentAngle / 2}, ${labelPosition(i).x}, ${labelPosition(i).y})`}
            >
              {label.length > 12 ? label.slice(0, 11) + '…' : label}
            </text>
          </g>
        ))}

        {/* Center hub */}
        <circle cx={center} cy={center} r="22" fill="#1a0e00" stroke="#F7941D" strokeWidth="2" />
        <text
          x={center}
          y={center}
          fill="#F7941D"
          fontSize="20"
          fontWeight="900"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Arial Black, Arial, sans-serif"
        >
          S
        </text>
      </svg>
    </div>
  )
}

/* ─── Main Page ─── */
export default function ConsumerPage() {
  const { isSignedIn, user } = useUser()
  const [sales, setSales] = useState<Sale[]>([])
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState<string | null>(null)
  const [spinResult, setSpinResult] = useState<{ prize: string; saleId: string } | null>(null)

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
  }

  function handleSpinComplete(saleId: string) {
    if (spinning === saleId) {
      setSpinning(null)
    }
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

                  {/* Spin Wheel */}
                  {spinResult?.saleId === sale.id ? (
                    <div
                      className="text-center py-4 rounded-2xl font-bold text-sm mb-3"
                      style={{ background: 'rgba(29,158,117,0.15)', color: '#1D9E75' }}
                    >
                      {spinResult.prize}
                    </div>
                  ) : (
                    <>
                      <SpinWheel
                        prizes={sale.prizes || []}
                        spinning={spinning === sale.id}
                        onSpinComplete={() => handleSpinComplete(sale.id)}
                      />
                      {isSignedIn ? (
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
                    </>
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
