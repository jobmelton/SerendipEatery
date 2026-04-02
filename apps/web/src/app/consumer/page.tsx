'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useUser, SignInButton } from '@clerk/nextjs'
import { NavBar } from '@/components/NavBar'

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

/* ─── Pick a Place Roulette ─── */
const CUISINE_EMOJI: Record<string, string> = {
  Mexican: '🌮', Italian: '🍝', American: '🍔', Asian: '🥡', Coffee: '☕',
  Pizza: '🍕', BBQ: '🔥', Sushi: '🍣', Thai: '🍜', Other: '🍽️',
}

const DEMO_PLACES = [
  { name: 'Fuego Tacos', cuisine: 'Mexican', distMi: 0.3 },
  { name: 'Coffee Corner', cuisine: 'Coffee', distMi: 0.4 },
  { name: 'Pizza Palace', cuisine: 'Pizza', distMi: 0.8 },
  { name: 'Sushi Haven', cuisine: 'Sushi', distMi: 1.2 },
  { name: 'BBQ Pit', cuisine: 'BBQ', distMi: 0.6 },
  { name: 'Thai Orchid', cuisine: 'Thai', distMi: 1.5 },
  { name: 'Bella Italia', cuisine: 'Italian', distMi: 0.9 },
  { name: 'Burger Barn', cuisine: 'American', distMi: 0.4 },
  { name: 'Taco Truck', cuisine: 'Mexican', distMi: 1.8 },
  { name: 'Noodle House', cuisine: 'Asian', distMi: 2.1 },
  { name: 'Espresso Lab', cuisine: 'Coffee', distMi: 3.2 },
  { name: 'Grill Master', cuisine: 'BBQ', distMi: 4.0 },
]

const RADII = [
  { label: '🚶 Walking', value: 0.5 },
  { label: '🚗 Short drive', value: 2 },
  { label: '🛣️ Road trip', value: 5 },
  { label: '🌍 Surprise me', value: 999 },
]

const CUISINES = ['All', 'Mexican', 'Italian', 'American', 'Asian', 'Coffee', 'Pizza', 'BBQ', 'Sushi', 'Thai']

const PICK_WHL_SZ = 260
const PICK_R = 105
const PICK_CX = 130
const PICK_ORBIT = (PICK_R + 8) * (PICK_WHL_SZ / (PICK_CX * 2))
const PICK_SETTLE = (PICK_R * 0.5) * (PICK_WHL_SZ / (PICK_CX * 2))

function PickAPlaceRoulette() {
  const [radius, setRadius] = useState(2)
  const [cuisine, setCuisine] = useState('All')
  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<typeof DEMO_PLACES[0] | null>(null)
  const [power, setPower] = useState(0)
  const [holding, setHolding] = useState(false)
  const ballRef = useRef<HTMLDivElement>(null)
  const pwrRef = useRef(0)
  const pwrInt = useRef<ReturnType<typeof setInterval> | null>(null)
  const ballAnim = useRef(0)

  // Filter places
  const filtered = DEMO_PLACES.filter((p) =>
    p.distMi <= radius && (cuisine === 'All' || p.cuisine === cuisine)
  )

  // Pad to at least 8 segments
  const padded: typeof DEMO_PLACES = []
  if (filtered.length === 0) {
    padded.push({ name: 'No matches', cuisine: 'Other', distMi: 0 })
  } else {
    while (padded.length < 8) {
      for (const p of filtered) {
        padded.push(p)
        if (padded.length >= Math.max(8, filtered.length)) break
      }
    }
  }
  const count = padded.length
  const seg = 360 / count

  function pol(d: number, r: number) {
    const rad = ((d - 90) * Math.PI) / 180
    return { x: PICK_CX + r * Math.cos(rad), y: PICK_CX + r * Math.sin(rad) }
  }

  function animBall(dur: number) {
    const el = ballRef.current
    if (!el) return
    const start = performance.now()
    const halfW = PICK_WHL_SZ / 2
    const startA = Math.random() * 360
    const totalOrbit = -(1800 + Math.random() * 1080)
    const offsetInSeg = (Math.random() - 0.5) * 0.6 * seg
    const finalA = offsetInSeg

    function tick(now: number) {
      const t = Math.min((now - start) / dur, 1)
      const orbitT = 1 - Math.pow(1 - t, 3)
      let angle = startA + totalOrbit * orbitT
      let r = PICK_ORBIT
      if (t > 0.6) {
        const ft = (t - 0.6) / 0.4
        const e = ft < 0.85 ? ft / 0.85 : 1 + Math.sin((ft - 0.85) / 0.15 * Math.PI) * 0.08
        r = PICK_ORBIT + (PICK_SETTLE - PICK_ORBIT) * e
      }
      if (t > 0.85) {
        const bt = (t - 0.85) / 0.15
        const e = bt * bt * (3 - 2 * bt)
        const norm = ((angle % 360) + 360) % 360
        let diff = finalA - norm
        if (diff > 180) diff -= 360
        if (diff < -180) diff += 360
        angle = norm + diff * e
      }
      const rad = ((angle - 90) * Math.PI) / 180
      if (!el) return
      el.style.left = `${halfW + r * Math.cos(rad) - 5}px`
      el.style.top = `${halfW + r * Math.sin(rad) - 5}px`
      if (t < 1) ballAnim.current = requestAnimationFrame(tick)
    }
    ballAnim.current = requestAnimationFrame(tick)
  }

  const startHold = () => {
    if (spinning) return
    setHolding(true); pwrRef.current = 0; setPower(0)
    pwrInt.current = setInterval(() => { pwrRef.current = Math.min(pwrRef.current + 100 / 30, 100); setPower(pwrRef.current) }, 100)
  }

  const releaseHold = () => {
    if (!holding || spinning) return
    setHolding(false)
    if (pwrInt.current) { clearInterval(pwrInt.current); pwrInt.current = null }

    const pwr = Math.max(pwrRef.current, 15) / 100
    setPower(0); setSpinning(true); setWinner(null)

    const winIdx = Math.floor(Math.random() * filtered.length) % padded.length
    const segCenter = winIdx * seg + seg / 2
    const jitter = (Math.random() - 0.5) * 0.6 * seg
    const target = 360 - segCenter + jitter
    const fullSpins = Math.ceil(3 + pwr * 5) * 360
    const curMod = ((rot % 360) + 360) % 360
    let delta = fullSpins + target - curMod
    if (delta < fullSpins) delta += 360

    setRot((prev) => prev + delta)

    const dur = 3000 + pwr * 2000
    animBall(dur)

    setTimeout(() => {
      setSpinning(false)
      const w = padded[winIdx]
      if (w && w.distMi > 0) setWinner(w)
    }, dur)
  }

  return (
    <div className="mt-10 w-full rounded-2xl p-6" style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.1)' }}>
      <h3 className="text-lg font-bold text-surface mb-4">Can't decide where to eat?</h3>

      {/* Step 1: Radius */}
      <p className="text-surface/50 text-xs font-bold mb-2 uppercase tracking-wider">How far will you go?</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {RADII.map((r) => (
          <button key={r.value} onClick={() => setRadius(r.value)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${radius === r.value ? 'bg-btc text-night' : 'bg-white/5 text-surface/40 border border-white/10 hover:text-surface/60'}`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Step 2: Cuisine */}
      <p className="text-surface/50 text-xs font-bold mb-2 uppercase tracking-wider">What are you feeling?</p>
      <div className="flex flex-wrap gap-2 mb-6">
        {CUISINES.map((c) => (
          <button key={c} onClick={() => setCuisine(c)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${cuisine === c ? 'bg-btc text-night' : 'bg-white/5 text-surface/40 border border-white/10 hover:text-surface/60'}`}>
            {c !== 'All' ? `${CUISINE_EMOJI[c] ?? '🍽️'} ` : ''}{c}
          </button>
        ))}
      </div>

      {/* Wheel */}
      <div className="flex justify-center">
        <div className="relative cursor-pointer select-none" style={{ width: PICK_WHL_SZ, height: PICK_WHL_SZ }}
          onMouseDown={startHold} onMouseUp={releaseHold}
          onMouseLeave={() => { if (holding) releaseHold() }}
          onTouchStart={startHold} onTouchEnd={releaseHold}>

          <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20">
            <div style={{ width: 0, height: 0, borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderTop: '15px solid #FFD700' }} />
          </div>

          {/* rAF ball */}
          <div ref={ballRef} className="absolute pointer-events-none z-10"
            style={{ width: 10, height: 10, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 28%, #fff, #d4d4d4 45%, #999)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
              left: PICK_WHL_SZ / 2 - 5, top: PICK_WHL_SZ / 2 - PICK_ORBIT - 5 }} />

          <svg viewBox={`0 0 ${PICK_CX * 2} ${PICK_CX * 2}`} width={PICK_WHL_SZ} height={PICK_WHL_SZ}
            style={{ transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 4.2s cubic-bezier(0.12,0.6,0.07,1)' : 'none' }}>
            <circle cx={PICK_CX} cy={PICK_CX} r={PICK_R + 12} fill="none" stroke="#D4AF37" strokeWidth="3" />
            {Array.from({ length: count }, (_, i) => {
              const place = padded[i]
              const a1 = i * seg, a2 = a1 + seg
              const p1 = pol(a1, PICK_R), p2 = pol(a2, PICK_R)
              const midA = a1 + seg / 2
              const lp = pol(midA, PICK_R * 0.6)
              const isO = i % 2 === 0
              const emoji = CUISINE_EMOJI[place.cuisine] ?? '🍽️'
              return (
                <g key={i}>
                  <path d={`M${PICK_CX},${PICK_CX} L${p1.x},${p1.y} A${PICK_R},${PICK_R} 0 0 1 ${p2.x},${p2.y} Z`}
                    fill={isO ? '#F7941D' : '#1a0e00'} stroke="#2a1400" strokeWidth="0.5" />
                  <text x={lp.x} y={lp.y} fill={isO ? '#1a0e00' : '#F7941D'} fontSize="7" fontWeight="bold"
                    textAnchor="middle" dominantBaseline="central" transform={`rotate(${midA},${lp.x},${lp.y})`}>
                    {`${emoji} ${place.name.slice(0, 8)}`}
                  </text>
                </g>
              )
            })}
            {/* Divider lines */}
            {Array.from({ length: count }, (_, i) => {
              const a = i * seg
              const o = pol(a, PICK_R), inn = pol(a, 16)
              return <line key={`d${i}`} x1={inn.x} y1={inn.y} x2={o.x} y2={o.y} stroke="#D4AF37" strokeWidth="0.6" opacity="0.4" />
            })}
            <circle cx={PICK_CX} cy={PICK_CX} r="16" fill="#1a0e00" stroke="#D4AF37" strokeWidth="2" />
            <text x={PICK_CX} y={PICK_CX} fill="#F7941D" fontSize="14" fontWeight="900" textAnchor="middle" dominantBaseline="central">?</text>
          </svg>
        </div>
      </div>

      {/* Power meter */}
      <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mx-auto mt-2 mb-1">
        <div className="h-full rounded-full" style={{ width: `${power}%`, background: power > 70 ? '#1D9E75' : '#F7941D', transition: holding ? 'none' : 'width 0.3s' }} />
      </div>
      <p className="text-surface/30 text-xs text-center mb-4">
        {spinning ? '\u00A0' : holding ? 'Release to spin!' : winner ? 'Hold to spin again' : 'Hold and release to spin'}
      </p>

      {/* Winner card */}
      {winner && (
        <div className="rounded-xl p-5 text-center" style={{ background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.2)' }}>
          <p className="text-3xl mb-1">{CUISINE_EMOJI[winner.cuisine] ?? '🍽️'}</p>
          <p className="text-teal font-black text-xl">{winner.name}</p>
          <p className="text-surface/50 text-sm">{winner.cuisine} • {winner.distMi} mi away</p>
          <div className="flex gap-3 justify-center mt-3">
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(winner.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-btc text-night font-bold px-5 py-2 rounded-full text-sm hover:bg-btc-dark transition"
            >
              Get Directions
            </a>
            <button onClick={() => setWinner(null)}
              className="border border-surface/20 text-surface/50 font-bold px-5 py-2 rounded-full text-sm hover:text-surface/70 transition">
              Spin Again
            </button>
          </div>
        </div>
      )}
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
      {isSignedIn ? (
        <NavBar variant="consumer" />
      ) : (
        <header className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
          <Link href="/" className="flex items-baseline gap-0.5">
            <span className="font-display text-xl font-black text-btc">S</span>
            <span className="font-display text-xl font-black text-surface">erendip</span>
            <span className="font-display text-xl font-black text-btc/40">Eatery</span>
          </Link>
          <div className="flex items-center gap-3">
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
          </div>
        </header>
      )}

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

        {/* ─── Pick a Place Roulette ─── */}
        <PickAPlaceRoulette />

        {/* Battle banner */}
        {isSignedIn && (
          <div
            className="mt-8 rounded-2xl p-4 flex items-center gap-3"
            style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.12)' }}
          >
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-btc animate-[pulse_2s_ease-in-out_infinite]" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-btc" />
            </span>
            <div className="flex-1">
              <p className="text-surface text-sm font-bold">Someone nearby wants to battle</p>
              <p className="text-surface/40 text-xs">Your next friend is 10 feet away</p>
            </div>
            <Link
              href="/consumer"
              className="bg-btc text-night text-xs font-bold px-4 py-2 rounded-full hover:bg-btc-dark transition whitespace-nowrap"
            >
              Battle Now
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
