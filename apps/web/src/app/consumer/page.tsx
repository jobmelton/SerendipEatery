'use client'

import { useState, useEffect, useCallback } from 'react'
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

/* ─── Spin Wheel ─── */
const NUM_SEGMENTS = 8
const WHEEL_SIZE = 260
const RADIUS = 110
const CENTER = 140
const INNER_RADIUS = 28
const STUD_RADIUS = RADIUS + 12
const STUD_COUNT = 24
const BALL_ORBIT_R = RADIUS + 8 // SVG units — between studs and outer ring
const BALL_ORBIT_PX = BALL_ORBIT_R * (WHEEL_SIZE / 280) // pixel-space orbit radius
const BALL_SIZE = 12

function polarToXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) }
}

function arcPath(startDeg: number, endDeg: number, outerR: number, innerR: number) {
  const s1 = polarToXY(startDeg, outerR)
  const e1 = polarToXY(endDeg, outerR)
  const s2 = polarToXY(endDeg, innerR)
  const e2 = polarToXY(startDeg, innerR)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return [
    `M${s1.x},${s1.y}`,
    `A${outerR},${outerR} 0 ${large} 1 ${e1.x},${e1.y}`,
    `L${s2.x},${s2.y}`,
    `A${innerR},${innerR} 0 ${large} 0 ${e2.x},${e2.y}`,
    'Z',
  ].join(' ')
}

function SpinWheel({
  prizes,
  spinning,
  onSpinComplete,
}: {
  prizes: Array<{ label: string }>
  spinning: boolean
  onSpinComplete: () => void
}) {
  const [rotation, setRotation] = useState(0)
  const [ballRotation, setBallRotation] = useState(45) // initial resting angle
  const [animating, setAnimating] = useState(false)

  const segments = Array.from({ length: NUM_SEGMENTS }, (_, i) => {
    const p = prizes[i % (prizes.length || 1)]
    return p?.label || '🎉'
  })

  const segAngle = 360 / NUM_SEGMENTS

  useEffect(() => {
    if (spinning && !animating) {
      setAnimating(true)
      // Wheel spins clockwise
      const wheelSpins = (5 + Math.random() * 3) * 360
      setRotation((prev) => prev + wheelSpins)
      // Ball orbits counter-clockwise (opposite), slightly more rotations
      const ballSpins = (6 + Math.random() * 3) * 360
      setBallRotation((prev) => prev - ballSpins)
      const timer = setTimeout(() => {
        setAnimating(false)
        onSpinComplete()
      }, 4200)
      return () => clearTimeout(timer)
    }
  }, [spinning])

  return (
    <div
      className="relative my-3"
      style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
    >
      {/* Pointer */}
      <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-20">
        <svg width="28" height="24" viewBox="0 0 28 24">
          <defs>
            <linearGradient id="pointerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFD700" />
              <stop offset="100%" stopColor="#B8860B" />
            </linearGradient>
          </defs>
          <polygon points="14,24 0,0 28,0" fill="url(#pointerGrad)" />
          <polygon points="14,24 0,0 28,0" fill="none" stroke="#FFD700" strokeWidth="1" opacity="0.6" />
        </svg>
      </div>

      {/* Ball — orbits counter-clockwise, decelerates independently */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          transform: `rotate(${ballRotation}deg)`,
          transition: animating
            ? 'transform 4.6s cubic-bezier(0.10, 0.65, 0.06, 1.02)'
            : 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: WHEEL_SIZE / 2 - BALL_ORBIT_PX - BALL_SIZE / 2,
            width: BALL_SIZE,
            height: BALL_SIZE,
            marginLeft: -BALL_SIZE / 2,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, #ffffff, #d0d0d0 50%, #a0a0a0)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.6), inset 0 -1px 2px rgba(0,0,0,0.15)',
          }}
        />
      </div>

      {/* Wheel */}
      <svg
        viewBox="0 0 280 280"
        width={WHEEL_SIZE}
        height={WHEEL_SIZE}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: animating
            ? 'transform 4.2s cubic-bezier(0.15, 0.6, 0.08, 1)'
            : 'none',
        }}
      >
        {/* Outer decorative ring */}
        <circle cx={CENTER} cy={CENTER} r={RADIUS + 16} fill="#1a0e00" stroke="#B8860B" strokeWidth="1.5" />
        <circle cx={CENTER} cy={CENTER} r={RADIUS + 4} fill="none" stroke="#B8860B" strokeWidth="0.5" opacity="0.4" />

        {/* Gold studs around the rim */}
        {Array.from({ length: STUD_COUNT }, (_, i) => {
          const pos = polarToXY((i * 360) / STUD_COUNT, STUD_RADIUS)
          return (
            <circle key={`stud-${i}`} cx={pos.x} cy={pos.y} r="2.5" fill="#FFD700" opacity="0.7" />
          )
        })}

        {/* Segments — donut shape so center stays clear */}
        {segments.map((label, i) => {
          const startA = i * segAngle
          const endA = startA + segAngle
          const isOrange = i % 2 === 0
          return (
            <g key={i}>
              <path
                d={arcPath(startA, endA, RADIUS, INNER_RADIUS)}
                fill={isOrange ? '#F7941D' : '#1a0e00'}
                stroke="#2a1800"
                strokeWidth="0.75"
              />
              {/* Radial text — positioned along the mid-angle, reading outward */}
              {(() => {
                const midA = startA + segAngle / 2
                const textR = (RADIUS + INNER_RADIUS) / 2 + 8
                const pos = polarToXY(midA, textR)
                const displayLabel = label.length > 14 ? label.slice(0, 13) + '…' : label
                return (
                  <text
                    x={pos.x}
                    y={pos.y}
                    fill={isOrange ? '#1a0e00' : '#F7941D'}
                    fontSize="8.5"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${midA}, ${pos.x}, ${pos.y})`}
                  >
                    {displayLabel}
                  </text>
                )
              })()}
            </g>
          )
        })}

        {/* Segment divider lines (thin gold) */}
        {Array.from({ length: NUM_SEGMENTS }, (_, i) => {
          const a = i * segAngle
          const inner = polarToXY(a, INNER_RADIUS)
          const outer = polarToXY(a, RADIUS)
          return (
            <line
              key={`div-${i}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#B8860B"
              strokeWidth="1"
              opacity="0.5"
            />
          )
        })}

        {/* Center hub */}
        <circle cx={CENTER} cy={CENTER} r={INNER_RADIUS + 2} fill="#1a0e00" stroke="#B8860B" strokeWidth="2" />
        <circle cx={CENTER} cy={CENTER} r={INNER_RADIUS - 2} fill="#1a0e00" stroke="#F7941D" strokeWidth="0.5" opacity="0.3" />
        <text
          x={CENTER}
          y={CENTER}
          fill="#F7941D"
          fontSize="22"
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

  const handleSpinComplete = useCallback((saleId: string) => {
    setSpinning((prev) => (prev === saleId ? null : prev))
  }, [])

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
                  className="rounded-2xl p-5 flex flex-col items-center"
                  style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.15)' }}
                >
                  <div className="flex items-start justify-between mb-3 w-full">
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
                    <p className="text-surface/40 text-sm mb-2 w-full">
                      {sale.distance_m < 1000
                        ? `${Math.round(sale.distance_m)}m away`
                        : `${(sale.distance_m / 1000).toFixed(1)}km away`}
                    </p>
                  )}

                  {/* Wheel or result */}
                  {spinResult?.saleId === sale.id ? (
                    <div
                      className="text-center py-4 px-6 rounded-2xl font-bold text-sm my-3 w-full"
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
