'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

/* ─── Wheel constants ─── */
const NUM_SEGMENTS = 8
const WHEEL_SIZE = 300
const RADIUS = 125
const CENTER = 155
const INNER_RADIUS = 30
const STUD_RADIUS = RADIUS + 13
const STUD_COUNT = 24
const TICK_INNER = RADIUS + 2
const TICK_OUTER = RADIUS + 10

const DEMO_PRIZES = [
  'Free Taco', '50% Off', 'Free Drink', 'Try Again',
  'Free Dessert', '25% Off', 'Free Side', 'Jackpot',
]

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

export default function LandingPage() {
  const [rotation, setRotation] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [ballRotation, setBallRotation] = useState(30)
  const [hasSpun, setHasSpun] = useState(false)

  const segAngle = 360 / NUM_SEGMENTS

  function handleDemoSpin() {
    if (animating) return
    setAnimating(true)
    setHasSpun(true)
    const spins = (5 + Math.random() * 3) * 360
    setRotation((prev) => prev + spins)
    const ballSpins = (6 + Math.random() * 3) * 360
    setBallRotation((prev) => prev - ballSpins)
    setTimeout(() => setAnimating(false), 4200)
  }

  const BALL_ORBIT_R = RADIUS + 8
  const BALL_ORBIT_PX = BALL_ORBIT_R * (WHEEL_SIZE / (CENTER * 2))
  const BALL_SIZE = 12

  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
      {/* ─── Spinning Roulette Wheel ─────────────────────────────────── */}
      <div
        className="relative cursor-pointer mb-2"
        style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
        onClick={handleDemoSpin}
      >
        {/* Pointer */}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20">
          <svg width="28" height="24" viewBox="0 0 28 24">
            <defs>
              <linearGradient id="ptrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFD700" />
                <stop offset="100%" stopColor="#B8860B" />
              </linearGradient>
            </defs>
            <polygon points="14,24 0,0 28,0" fill="url(#ptrGrad)" />
            <polygon points="14,24 0,0 28,0" fill="none" stroke="#FFD700" strokeWidth="1" opacity="0.6" />
          </svg>
        </div>

        {/* Ball */}
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

        {/* Wheel SVG */}
        <svg
          viewBox={`0 0 ${CENTER * 2} ${CENTER * 2}`}
          width={WHEEL_SIZE}
          height={WHEEL_SIZE}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: animating
              ? 'transform 4.2s cubic-bezier(0.15, 0.6, 0.08, 1)'
              : 'none',
          }}
        >
          {/* Outer gold ring */}
          <circle cx={CENTER} cy={CENTER} r={RADIUS + 18} fill="#1a0e00" stroke="#B8860B" strokeWidth="1.5" />
          <circle cx={CENTER} cy={CENTER} r={RADIUS + 4} fill="none" stroke="#B8860B" strokeWidth="0.5" opacity="0.4" />

          {/* Gold studs */}
          {Array.from({ length: STUD_COUNT }, (_, i) => {
            const pos = polarToXY((i * 360) / STUD_COUNT, STUD_RADIUS)
            return <circle key={`s-${i}`} cx={pos.x} cy={pos.y} r="2.5" fill="#FFD700" opacity="0.7" />
          })}

          {/* Tick marks between segments */}
          {Array.from({ length: NUM_SEGMENTS }, (_, i) => {
            const a = i * segAngle
            const inner = polarToXY(a, TICK_INNER)
            const outer = polarToXY(a, TICK_OUTER)
            return (
              <line
                key={`tick-${i}`}
                x1={inner.x} y1={inner.y}
                x2={outer.x} y2={outer.y}
                stroke="#FFD700" strokeWidth="1.5" opacity="0.8"
              />
            )
          })}

          {/* Segments */}
          {DEMO_PRIZES.map((label, i) => {
            const startA = i * segAngle
            const endA = startA + segAngle
            const isOrange = i % 2 === 0
            const midA = startA + segAngle / 2
            const textR = (RADIUS + INNER_RADIUS) / 2 + 10
            const pos = polarToXY(midA, textR)
            return (
              <g key={i}>
                <path
                  d={arcPath(startA, endA, RADIUS, INNER_RADIUS)}
                  fill={isOrange ? '#F7941D' : '#1a0e00'}
                  stroke="#2a1800"
                  strokeWidth="0.75"
                />
                <text
                  x={pos.x}
                  y={pos.y}
                  fill={isOrange ? '#1a0e00' : '#F7941D'}
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${midA}, ${pos.x}, ${pos.y})`}
                >
                  {label}
                </text>
              </g>
            )
          })}

          {/* Segment dividers */}
          {Array.from({ length: NUM_SEGMENTS }, (_, i) => {
            const a = i * segAngle
            const inner = polarToXY(a, INNER_RADIUS)
            const outer = polarToXY(a, RADIUS)
            return (
              <line
                key={`div-${i}`}
                x1={inner.x} y1={inner.y}
                x2={outer.x} y2={outer.y}
                stroke="#B8860B" strokeWidth="1" opacity="0.5"
              />
            )
          })}

          {/* Center hub */}
          <circle cx={CENTER} cy={CENTER} r={INNER_RADIUS + 2} fill="#1a0e00" stroke="#B8860B" strokeWidth="2" />
          <circle cx={CENTER} cy={CENTER} r={INNER_RADIUS - 2} fill="#1a0e00" stroke="#F7941D" strokeWidth="0.5" opacity="0.3" />
          <text
            x={CENTER} y={CENTER}
            fill="#F7941D" fontSize="24" fontWeight="900"
            textAnchor="middle" dominantBaseline="central"
            fontFamily="Arial Black, Arial, sans-serif"
          >
            S
          </text>
        </svg>
      </div>

      {/* Spin hint */}
      <p className="text-surface/30 text-xs mb-8 tracking-wide">
        {animating ? '\u00A0' : hasSpun ? 'Tap to spin again' : 'Click to spin'}
      </p>

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
      <p className="text-lg md:text-xl font-bold tracking-wider text-surface/50 mb-14">
        Spin. Win. Eat.
      </p>

      {/* ─── Buttons ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md">
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

      {/* ─── App Download ────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mt-8">
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
    </main>
  )
}
