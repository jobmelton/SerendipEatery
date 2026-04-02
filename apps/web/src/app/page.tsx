'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

/* ─── Wheel Config ─── */
const NUM_SEGMENTS = 12
const WHEEL_PX = 320
const R = 140          // segment outer radius
const INNER_R = 32     // center hub radius
const CX = 160         // viewBox center
const CY = 160
const PEG_R = R + 12   // peg orbit radius
const RING_R = R + 18  // outer ring radius
const SEG_ANGLE = 360 / NUM_SEGMENTS

const PRIZES = [
  'Free Taco', '50% Off', 'Free Drink', 'Try Again',
  'Free Dessert', '25% Off', 'Free Side', 'Jackpot',
  'Free Coffee', '10% Off', 'Free Fries', 'Spin Again',
]

const SAMPLE_DEALS = [
  { biz: 'Fuego Tacos', sale: 'Friday Flash Sale', status: 'Active Now', initial: 'F', soon: false },
  { biz: 'Coffee Corner', sale: 'Morning Boost', status: 'Active Now', initial: 'C', soon: false },
  { biz: 'Pizza Palace', sale: 'Lunch Rush', status: 'Active Now', initial: 'P', soon: false },
  { biz: 'Burger Barn', sale: 'Happy Hour', status: 'Starting Soon', initial: 'B', soon: true },
]

function pol(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function slicePath(i: number) {
  const a1 = i * SEG_ANGLE
  const a2 = a1 + SEG_ANGLE
  const p1 = pol(a1, R)
  const p2 = pol(a2, R)
  return `M${CX},${CY} L${p1.x},${p1.y} A${R},${R} 0 0 1 ${p2.x},${p2.y} Z`
}

export default function LandingPage() {
  const [rotation, setRotation] = useState(0)
  const [ballAngle, setBallAngle] = useState(20)
  const [spinning, setSpinning] = useState(false)
  const [hasSpun, setHasSpun] = useState(false)
  const [winToast, setWinToast] = useState<string | null>(null)

  const handleSpin = useCallback(() => {
    if (spinning) return
    setSpinning(true)
    setHasSpun(true)
    setWinToast(null)

    // Pick a random winning segment
    const winIdx = Math.floor(Math.random() * NUM_SEGMENTS)
    // Spin wheel: 5-8 full rotations + land so winning segment is at top (pointer)
    const targetAngle = 360 - (winIdx * SEG_ANGLE + SEG_ANGLE / 2)
    const fullSpins = (5 + Math.random() * 3) * 360
    const wheelDelta = fullSpins + targetAngle - (rotation % 360)
    setRotation((prev) => prev + wheelDelta)

    // Ball goes opposite direction
    const ballSpins = (6 + Math.random() * 3) * 360
    setBallAngle((prev) => prev - ballSpins)

    setTimeout(() => {
      setSpinning(false)
      setWinToast(PRIZES[winIdx])
      setTimeout(() => setWinToast(null), 3500)
    }, 4200)
  }, [spinning, rotation])

  const BALL_ORBIT = (R + 8) * (WHEEL_PX / (CX * 2))
  const BALL_SZ = 13

  return (
    <main className="min-h-screen bg-night flex flex-col items-center px-6 pt-12 pb-20">
      {/* ─── Roulette Wheel ──────────────────────────────────────────── */}
      <div
        className="relative cursor-pointer mb-1"
        style={{ width: WHEEL_PX, height: WHEEL_PX }}
        onClick={handleSpin}
      >
        {/* Pointer */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20">
          <svg width="30" height="28" viewBox="0 0 30 28">
            <defs>
              <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFD700" />
                <stop offset="100%" stopColor="#B8860B" />
              </linearGradient>
            </defs>
            <polygon points="15,28 0,0 30,0" fill="url(#pGrad)" />
            <polygon points="15,28 0,0 30,0" fill="none" stroke="#FFD700" strokeWidth="1" opacity="0.5" />
          </svg>
        </div>

        {/* Ball orbit wrapper */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            transform: `rotate(${ballAngle}deg)`,
            transition: spinning
              ? 'transform 4.6s cubic-bezier(0.08, 0.65, 0.05, 1.02)'
              : 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: WHEEL_PX / 2 - BALL_ORBIT - BALL_SZ / 2,
              width: BALL_SZ,
              height: BALL_SZ,
              marginLeft: -BALL_SZ / 2,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 28%, #fff, #d4d4d4 45%, #999)',
              boxShadow: '0 1px 5px rgba(0,0,0,0.7), inset 0 -1px 2px rgba(0,0,0,0.2)',
            }}
          />
        </div>

        {/* Wheel SVG */}
        <svg
          viewBox={`0 0 ${CX * 2} ${CY * 2}`}
          width={WHEEL_PX}
          height={WHEEL_PX}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? 'transform 4.2s cubic-bezier(0.12, 0.6, 0.07, 1)'
              : 'none',
          }}
        >
          {/* Outer gold ring */}
          <circle cx={CX} cy={CY} r={RING_R} fill="none" stroke="#D4AF37" strokeWidth="4" />
          <circle cx={CX} cy={CY} r={R + 3} fill="none" stroke="#D4AF37" strokeWidth="1" opacity="0.4" />

          {/* Pegs between segments */}
          {Array.from({ length: NUM_SEGMENTS }, (_, i) => {
            const p = pol(i * SEG_ANGLE, PEG_R)
            return (
              <g key={`peg-${i}`}>
                <circle cx={p.x} cy={p.y} r="4" fill="#D4AF37" />
                <circle cx={p.x} cy={p.y} r="2.5" fill="#FFD700" />
              </g>
            )
          })}

          {/* 12 pie-slice segments */}
          {PRIZES.map((label, i) => {
            const isOrange = i % 2 === 0
            const midA = i * SEG_ANGLE + SEG_ANGLE / 2
            const labelR = R * 0.62
            const lp = pol(midA, labelR)
            const truncated = label.length > 11 ? label.slice(0, 10) + '…' : label
            return (
              <g key={`seg-${i}`}>
                <path
                  d={slicePath(i)}
                  fill={isOrange ? '#F7941D' : '#1a0e00'}
                  stroke="#2a1400"
                  strokeWidth="0.5"
                />
                <text
                  x={lp.x}
                  y={lp.y}
                  fill={isOrange ? '#1a0e00' : '#F7941D'}
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${midA}, ${lp.x}, ${lp.y})`}
                >
                  {truncated}
                </text>
              </g>
            )
          })}

          {/* Segment divider lines */}
          {Array.from({ length: NUM_SEGMENTS }, (_, i) => {
            const a = i * SEG_ANGLE
            const outer = pol(a, R)
            const inner = pol(a, INNER_R + 4)
            return (
              <line
                key={`d-${i}`}
                x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke="#D4AF37" strokeWidth="0.8" opacity="0.45"
              />
            )
          })}

          {/* Center hub */}
          <circle cx={CX} cy={CY} r={INNER_R + 2} fill="#1a0e00" stroke="#D4AF37" strokeWidth="2.5" />
          <circle cx={CX} cy={CY} r={INNER_R - 4} fill="#1a0e00" stroke="#F7941D" strokeWidth="0.5" opacity="0.3" />
          <text
            x={CX} y={CY}
            fill="#F7941D" fontSize="26" fontWeight="900"
            textAnchor="middle" dominantBaseline="central"
            fontFamily="Arial Black, Arial, sans-serif"
          >
            S
          </text>
        </svg>
      </div>

      {/* Spin hint */}
      <p className="text-surface/30 text-xs mb-6 tracking-wide">
        {spinning ? '\u00A0' : hasSpun ? 'Tap to spin again' : 'Click to spin'}
      </p>

      {/* Win toast */}
      {winToast && (
        <div
          className="fixed top-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg animate-bounce"
          style={{ background: '#F7941D', color: '#1a0e00' }}
        >
          <span className="font-black text-lg">You won: {winToast}!</span>
        </div>
      )}

      {/* ─── Logo ────────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-col items-end">
        <div style={{ fontSize: '2.5rem', lineHeight: 1, fontWeight: 900 }} className="font-display">
          <span className="text-btc">S</span>
          <span className="text-surface">erendip</span>
        </div>
        <div
          className="font-display"
          style={{
            fontSize: '2.3rem',
            lineHeight: 1,
            fontWeight: 900,
            transform: 'rotate(180deg)',
            background: 'linear-gradient(to right, transparent, #F7941D)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginTop: '-0.1rem',
          }}
        >
          Eatery
        </div>
      </div>

      {/* ─── Tagline ─────────────────────────────────────────────────── */}
      <p className="text-lg md:text-xl font-bold tracking-wider text-surface/50 mb-10">
        Spin. Win. Connect. Eat.
      </p>

      {/* ─── Buttons ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md mb-14">
        <Link
          href="/consumer"
          className="w-full sm:w-auto flex-1 bg-btc text-night font-bold text-lg px-8 py-4 rounded-full text-center hover:bg-btc-dark transition"
        >
          I want deals
        </Link>
        <Link
          href="/business"
          className="w-full sm:w-auto flex-1 border-2 border-surface/20 text-surface/70 font-bold text-lg px-8 py-4 rounded-full text-center hover:border-surface/40 hover:text-surface transition"
        >
          I have a business
        </Link>
      </div>

      {/* ─── How It Works ──────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-10 md:gap-16 mb-10">
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl">🎰</span>
          <span className="text-surface/50 text-xs font-bold">Spin</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl">🎁</span>
          <span className="text-surface/50 text-xs font-bold">Win</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl">⚔️</span>
          <span className="text-surface/50 text-xs font-bold">Connect</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl">🍽️</span>
          <span className="text-surface/50 text-xs font-bold">Eat</span>
        </div>
      </div>

      {/* ─── P2P Battle Teaser ───────────────────────────────────────── */}
      <div
        className="w-full max-w-lg rounded-2xl p-6 mb-14 text-center"
        style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.1)' }}
      >
        <h3 className="text-xl font-black text-surface mb-2">
          Your next friend is 10 feet away.
        </h3>
        <p className="text-surface/50 text-sm mb-2">
          Battle nearby strangers in rock paper scissors. Winner loots the loser's deals.
        </p>
        <p className="text-surface/30 text-xs">
          Turn strangers into friends, one battle at a time.
        </p>
      </div>

      {/* ─── Sample Deal Cards ───────────────────────────────────────── */}
      <div className="w-full max-w-3xl">
        <h2 className="text-xl font-bold text-surface mb-4">Flash sales near you</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SAMPLE_DEALS.map((deal) => (
            <div
              key={deal.biz}
              className="rounded-2xl p-5"
              style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.12)' }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-night shrink-0"
                  style={{ background: '#F7941D' }}
                >
                  {deal.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-surface text-base truncate">{deal.biz}</h3>
                  <p className="text-surface/40 text-sm">{deal.sale}</p>
                </div>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{
                    background: deal.soon ? 'rgba(83,74,183,0.2)' : 'rgba(29,158,117,0.15)',
                    color: deal.soon ? '#534AB7' : '#1D9E75',
                  }}
                >
                  {deal.status}
                </span>
              </div>
              <Link
                href="/consumer"
                className={`block w-full text-center py-2.5 rounded-full text-sm font-bold transition ${
                  deal.soon
                    ? 'border border-surface/15 text-surface/40 cursor-default'
                    : 'bg-btc text-night hover:bg-btc-dark'
                }`}
              >
                {deal.soon ? 'Coming Soon' : 'Spin to Win'}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* ─── App Download ────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mt-12">
        <Link
          href="/coming-soon-app"
          className="border border-surface/20 text-surface/50 text-sm px-5 py-2 rounded-full hover:border-surface/40 hover:text-surface/70 transition"
        >
          Download for iOS
        </Link>
        <Link
          href="/coming-soon-app"
          className="border border-surface/20 text-surface/50 text-sm px-5 py-2 rounded-full hover:border-surface/40 hover:text-surface/70 transition"
        >
          Download for Android
        </Link>
      </div>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer className="mt-16 pt-8 border-t border-white/5 w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-surface/30 text-xs">
          <Link href="/pricing" className="hover:text-surface/50 transition">Pricing</Link>
          <Link href="/business" className="hover:text-surface/50 transition">Business</Link>
          <Link href="/consumer" className="hover:text-surface/50 transition">Consumer</Link>
          <Link href="/coming-soon-app" className="hover:text-surface/50 transition">Download App</Link>
        </div>
      </footer>
    </main>
  )
}
