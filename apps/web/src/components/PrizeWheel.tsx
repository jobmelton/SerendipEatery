'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'

/* ─── Weighted Prize Segments ─── */
export interface WheelPrize {
  label: string
  weight: number // percentage 0-100
  color: string
}

export const DEFAULT_PRIZES: WheelPrize[] = [
  { label: 'Try Again',   weight: 25, color: '#2a2a2a' },
  { label: 'Free Side',   weight: 15, color: '#FF4500' },
  { label: '10% Off',     weight: 15, color: '#4169E1' },
  { label: 'Free Drink',  weight: 12, color: '#00CED1' },
  { label: '25% Off',     weight: 12, color: '#9400D3' },
  { label: '50% Off',     weight: 10, color: '#FF1493' },
  { label: 'Free Taco',   weight: 8,  color: '#32CD32' },
  { label: 'Jackpot',     weight: 3,  color: '#FFD700' },
]

const WHL = 320
const R = 135
const CX = 160
const INNER_R = 28
const ORBIT_R_PX = (R + 8) * (WHL / (CX * 2))
const SETTLE_R_PX = (R * 0.5) * (WHL / (CX * 2))
const BALL_SZ = 10

function pol(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}
const CY = CX

// Build cumulative angles from weights
function buildSegments(prizes: WheelPrize[]) {
  const total = prizes.reduce((s, p) => s + p.weight, 0)
  let cumAngle = 0
  return prizes.map((p) => {
    const startA = cumAngle
    const sweep = (p.weight / total) * 360
    cumAngle += sweep
    return { ...p, startA, sweep, midA: startA + sweep / 2 }
  })
}

function weightedSlicePath(startA: number, sweep: number, r: number) {
  const p1 = pol(startA, r)
  const p2 = pol(startA + sweep, r)
  const large = sweep > 180 ? 1 : 0
  return `M${CX},${CY} L${p1.x},${p1.y} A${r},${r} 0 ${large} 1 ${p2.x},${p2.y} Z`
}

/* ─── Confetti System ─── */
function Confetti({ active }: { active: boolean }) {
  if (!active) return null
  const particles = Array.from({ length: 50 }, (_, i) => {
    const angle = Math.random() * 360
    const dist = 80 + Math.random() * 200
    const size = 4 + Math.random() * 6
    const color = ['#FFD700', '#FF1493', '#32CD32', '#4169E1', '#FF4500', '#00CED1', '#9400D3', '#F7941D'][Math.floor(Math.random() * 8)]
    const delay = Math.random() * 0.3
    const shape = Math.random() > 0.5 ? 'circle' : 'star'
    return { angle, dist, size, color, delay, shape, id: i }
  })

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-[confettiBurst_1.5s_ease-out_forwards]"
          style={{
            width: p.size, height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            transform: p.shape === 'star' ? 'rotate(45deg)' : 'none',
            '--tx': `${Math.cos(p.angle * Math.PI / 180) * p.dist}px`,
            '--ty': `${Math.sin(p.angle * Math.PI / 180) * p.dist}px`,
            animationDelay: `${p.delay}s`,
            opacity: 0,
          } as any}
        />
      ))}
      <style>{`
        @keyframes confettiBurst {
          0% { transform: translate(0, 0) scale(0); opacity: 1; }
          30% { opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(1) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

/* ─── Win Overlay ─── */
function WinOverlay({ prize, color, onWallet, onUseNow, onDismiss, isGuest }: {
  prize: string; color: string; onWallet: () => void; onUseNow: () => void; onDismiss: () => void; isGuest: boolean
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ background: `${color}20` }}>
      <div
        className="rounded-3xl p-8 max-w-sm w-full text-center animate-[slamIn_0.5s_cubic-bezier(0.34,1.56,0.64,1)]"
        style={{ background: '#fff', color: '#1a0e00' }}
      >
        <p className="text-5xl mb-3">🎉</p>
        <h2 className="text-3xl font-black mb-2" style={{ color }}>{prize}</h2>
        <p className="text-gray-500 text-sm mb-6">You won!</p>
        {isGuest ? (
          <div className="space-y-3">
            <Link href="/sign-up" className="block w-full bg-[#F7941D] text-[#0f0a1e] font-bold py-3 rounded-xl hover:opacity-90 transition">
              Sign Up to Claim 👛
            </Link>
            <button onClick={onDismiss} className="w-full text-gray-400 text-sm py-2">Maybe later</button>
          </div>
        ) : (
          <div className="space-y-3">
            <button onClick={onWallet} className="w-full bg-[#F7941D] text-[#0f0a1e] font-bold py-3 rounded-xl hover:opacity-90 transition">
              Add to Wallet 👛
            </button>
            <button onClick={onUseNow} className="w-full border-2 border-gray-300 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 transition">
              Use Now 📍
            </button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes slamIn {
          0% { transform: translateY(-80px) scale(0.5); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/* ─── Try Again Shake ─── */
function TryAgainToast({ onSpin }: { onSpin: () => void }) {
  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 animate-[shakeOnce_0.3s_ease]">
      <div className="rounded-2xl p-6 text-center" style={{ background: '#1a1230', border: '1px solid rgba(255,255,255,0.1)' }}>
        <p className="text-2xl mb-2">😬</p>
        <p className="text-white font-bold mb-3">Not this time!</p>
        <button onClick={onSpin} className="bg-[#F7941D] text-[#0f0a1e] font-bold px-6 py-2 rounded-full text-sm">Spin again?</button>
      </div>
      <style>{`
        @keyframes shakeOnce { 0%,100%{transform:translate(-50%,-50%)} 25%{transform:translate(-54%,-50%)} 75%{transform:translate(-46%,-50%)} }
      `}</style>
    </div>
  )
}

/* ─── Main PrizeWheel Component ─── */
export function PrizeWheel({
  prizes = DEFAULT_PRIZES,
  isGuest = true,
  onClaim,
}: {
  prizes?: WheelPrize[]
  isGuest?: boolean
  onClaim?: (prize: string) => void
}) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [power, setPower] = useState(0)
  const [holding, setHolding] = useState(false)
  const [hasSpun, setHasSpun] = useState(false)
  const [winPrize, setWinPrize] = useState<{ label: string; color: string } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [showTryAgain, setShowTryAgain] = useState(false)
  const [wheelPulse, setWheelPulse] = useState(false)
  const [edgeGlow, setEdgeGlow] = useState<string | null>(null)
  const ballRef = useRef<HTMLDivElement>(null)
  const ballAnimRef = useRef(0)
  const powerInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const powerRef = useRef(0)

  const segments = buildSegments(prizes)
  const pegCount = prizes.length

  const startHold = useCallback(() => {
    if (spinning) return
    setHolding(true); powerRef.current = 0; setPower(0)
    powerInterval.current = setInterval(() => {
      powerRef.current = Math.min(powerRef.current + 100 / 30, 100)
      setPower(powerRef.current)
    }, 100)
  }, [spinning])

  // Animate ball
  function animateBall(duration: number, _winIdx: number) {
    const el = ballRef.current
    if (!el) return
    const start = performance.now()
    const halfW = WHL / 2
    const startAngle = Math.random() * 360
    const fullSpins = 5 + Math.floor(Math.random() * 3)
    const jitter = (Math.random() - 0.5) * 10
    const totalOrbit = -(fullSpins * 360 + jitter - startAngle)

    function easeOut(t: number) { return 1 - Math.pow(1 - t, 3) }
    function tick(now: number) {
      if (!el) return
      const t = Math.min((now - start) / duration, 1)
      const angle = startAngle + totalOrbit * easeOut(t)
      let radius = ORBIT_R_PX
      if (t > 0.85) radius = ORBIT_R_PX + (SETTLE_R_PX - ORBIT_R_PX) * Math.min((t - 0.85) / 0.10, 1)
      let bounce = 0
      if (t > 0.95) bounce = Math.sin((t - 0.95) * 20 * Math.PI) * (1 - t) * 8
      const rad = ((angle - 90) * Math.PI) / 180
      el.style.left = `${halfW + (radius + bounce) * Math.cos(rad) - BALL_SZ / 2}px`
      el.style.top = `${halfW + (radius + bounce) * Math.sin(rad) - BALL_SZ / 2}px`
      if (t < 1) ballAnimRef.current = requestAnimationFrame(tick)
    }
    ballAnimRef.current = requestAnimationFrame(tick)
  }

  const releaseHold = useCallback(() => {
    if (!holding || spinning) return
    setHolding(false)
    if (powerInterval.current) { clearInterval(powerInterval.current); powerInterval.current = null }

    const pwr = Math.max(powerRef.current, 15) / 100
    setPower(0); setSpinning(true); setHasSpun(true)
    setWinPrize(null); setShowOverlay(false); setShowTryAgain(false)

    // Pick winner based on weights
    const total = prizes.reduce((s, p) => s + p.weight, 0)
    let rand = Math.random() * total, winIdx = 0
    for (let i = 0; i < prizes.length; i++) { rand -= prizes[i].weight; if (rand <= 0) { winIdx = i; break } }

    // Calculate exact angle for this weighted segment
    const seg = segments[winIdx]
    const targetCenter = seg.startA + seg.sweep / 2
    const jitter = (Math.random() - 0.5) * 0.5 * seg.sweep
    const targetAngle = 360 - targetCenter + jitter
    const fullSpins = Math.ceil(3 + pwr * 5) * 360
    const curMod = ((rotation % 360) + 360) % 360
    let delta = fullSpins + targetAngle - curMod
    if (delta < fullSpins) delta += 360
    setRotation((prev) => prev + delta)

    const duration = 3000 + pwr * 2000
    animateBall(duration, winIdx)

    setTimeout(() => {
      setSpinning(false)
      const won = prizes[winIdx]

      if (won.label === 'Try Again' || won.label === 'Spin Again') {
        // Shake + quick dismiss
        setShowTryAgain(true)
        setTimeout(() => setShowTryAgain(false), 3000)
        return
      }

      // Win celebration phases
      setWinPrize({ label: won.label, color: won.color })

      // Phase 1: wheel pulse
      setWheelPulse(true)
      setTimeout(() => setWheelPulse(false), 500)

      // Phase 2: confetti
      setTimeout(() => setShowConfetti(true), 400)
      setTimeout(() => setShowConfetti(false), 2500)

      // Phase 3+4: overlay
      setTimeout(() => setShowOverlay(true), 1000)

      // Phase 5: edge glow
      setEdgeGlow(won.color)
      setTimeout(() => setEdgeGlow(null), 2500)

    }, duration)
  }, [holding, spinning, rotation, prizes, segments])

  return (
    <div className="relative">
      {/* Edge glow */}
      {edgeGlow && (
        <div className="fixed inset-0 pointer-events-none z-30 animate-pulse" style={{ boxShadow: `inset 0 0 80px ${edgeGlow}40` }} />
      )}

      <Confetti active={showConfetti} />

      {showTryAgain && <TryAgainToast onSpin={() => { setShowTryAgain(false) }} />}

      {showOverlay && winPrize && (
        <WinOverlay
          prize={winPrize.label}
          color={winPrize.color}
          isGuest={isGuest}
          onWallet={() => { onClaim?.(winPrize.label); setShowOverlay(false) }}
          onUseNow={() => { setShowOverlay(false) }}
          onDismiss={() => setShowOverlay(false)}
        />
      )}

      {/* Wheel container */}
      <div
        className={`relative cursor-pointer select-none mx-auto ${wheelPulse ? 'animate-[wheelPulse_0.5s_ease]' : ''}`}
        style={{ width: WHL, height: WHL }}
        onMouseDown={startHold} onMouseUp={releaseHold}
        onMouseLeave={() => { if (holding) releaseHold() }}
        onTouchStart={startHold} onTouchEnd={releaseHold}
      >
        {/* Pointer */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20">
          <svg width="30" height="28" viewBox="0 0 30 28">
            <defs><linearGradient id="wpGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFD700" /><stop offset="100%" stopColor="#B8860B" /></linearGradient></defs>
            <polygon points="15,28 0,0 30,0" fill="url(#wpGrad)" />
          </svg>
        </div>

        {/* Ball */}
        <div ref={ballRef} className="absolute pointer-events-none z-10"
          style={{ width: BALL_SZ, height: BALL_SZ, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 28%, #fff, #d4d4d4 45%, #999)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
            left: WHL / 2 - BALL_SZ / 2, top: WHL / 2 - ORBIT_R_PX - BALL_SZ / 2 }} />

        {/* Wheel SVG */}
        <svg viewBox={`0 0 ${CX * 2} ${CX * 2}`} width={WHL} height={WHL}
          style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 4.2s cubic-bezier(0.12,0.6,0.07,1)' : 'none' }}>

          {/* Outer gold ring */}
          <circle cx={CX} cy={CX} r={R + 16} fill="none" stroke="#FFD700" strokeWidth="3" />
          <circle cx={CX} cy={CX} r={R + 2} fill="none" stroke="#FFD700" strokeWidth="0.5" opacity="0.3" />

          {/* Metallic bumps */}
          {segments.map((seg, i) => {
            const p = pol(seg.startA, R + 10)
            return <circle key={`bump-${i}`} cx={p.x} cy={p.y} r="3.5" fill="#FFD700" />
          })}

          {/* Weighted segments */}
          {segments.map((seg, i) => {
            const lp = pol(seg.midA, R * 0.6)
            const textColor = seg.color === '#2a2a2a' || seg.color === '#9400D3' || seg.color === '#4169E1' ? '#fff' : '#1a0e00'
            return (
              <g key={`wseg-${i}`}>
                <path d={weightedSlicePath(seg.startA, seg.sweep, R)} fill={seg.color} stroke="#FFD700" strokeWidth="1" />
                <text x={lp.x} y={lp.y} fill={textColor} fontSize={seg.sweep < 20 ? '6' : '8'} fontWeight="bold"
                  textAnchor="middle" dominantBaseline="central" transform={`rotate(${seg.midA},${lp.x},${lp.y})`}>
                  {seg.label.length > 10 ? seg.label.slice(0, 9) + '…' : seg.label}
                </text>
              </g>
            )
          })}

          {/* Center hub */}
          <circle cx={CX} cy={CX} r={INNER_R + 2} fill="#1a0e00" stroke="#FFD700" strokeWidth="2" />
          <text x={CX} y={CX} fill="#FFD700" fontSize="22" fontWeight="900" textAnchor="middle" dominantBaseline="central" fontFamily="Arial Black,sans-serif">S</text>
        </svg>
      </div>

      {/* Power meter */}
      <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden mx-auto mt-2 mb-1">
        <div className="h-full rounded-full" style={{ width: `${power}%`, background: power > 70 ? '#1D9E75' : '#F7941D', transition: holding ? 'none' : 'width 0.3s' }} />
      </div>
      <p className="text-surface/30 text-xs text-center mb-4">
        {spinning ? '\u00A0' : holding ? 'Release to spin!' : hasSpun ? 'Hold to spin again' : 'Hold and release to spin'}
      </p>

      <style>{`
        @keyframes wheelPulse { 0%{transform:scale(1)} 33%{transform:scale(1.03)} 66%{transform:scale(0.98)} 100%{transform:scale(1)} }
      `}</style>
    </div>
  )
}
