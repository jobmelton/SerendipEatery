'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'

/* ─── Wheel Config ─── */
const NUM_SEGMENTS = 12
const WHEEL_PX = 320
const R = 140
const INNER_R = 32
const CX = 160
const CY = 160
const PEG_R = R + 12
const RING_R = R + 18
const SEG_ANGLE = 360 / NUM_SEGMENTS

const PRIZES = [
  'Free Taco', '50% Off', 'Free Drink', 'Try Again',
  'Free Dessert', '25% Off', 'Free Side', 'Jackpot',
  'Free Coffee', '10% Off', 'Free Fries', 'Spin Again',
]

const SAMPLE_DEALS = [
  { biz: 'Fuego Tacos', sale: 'Friday Flash Sale', status: 'Active Now', initial: 'F', soon: false,
    prizes: ['Free Taco', '20% Off', 'Free Guac', 'Free Drink', 'Try Again', '10% Off'] },
  { biz: 'Coffee Corner', sale: 'Morning Boost', status: 'Active Now', initial: 'C', soon: false,
    prizes: ['Free Coffee', 'Free Pastry', '50% Off', 'Try Again', 'Free Latte', '25% Off'] },
  { biz: 'Pizza Palace', sale: 'Lunch Rush', status: 'Active Now', initial: 'P', soon: false,
    prizes: ['Free Slice', 'Free Drink', '30% Off', 'Free Garlic Bread', 'Try Again', 'Free Dessert'] },
  { biz: 'Burger Barn', sale: 'Happy Hour', status: 'Starting Soon', initial: 'B', soon: true,
    prizes: ['Free Fries', 'Free Shake', '25% Off', 'Free Burger', 'Try Again', '10% Off'] },
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

/* ─── Mini wheel for modal ─── */
function MiniWheel({ prizes, size = 200, onSpin }: { prizes: string[]; size?: number; onSpin?: (prize: string) => void }) {
  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const count = prizes.length || 6
  const seg = 360 / count
  const r = size / 2 - 10
  const cx = size / 2
  const pr = (d: number, radius: number) => {
    const rad = ((d - 90) * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cx + radius * Math.sin(rad) }
  }

  const spin = () => {
    if (spinning) return
    setSpinning(true)
    const winIdx = Math.floor(Math.random() * count)
    const target = 360 - (winIdx * seg + seg / 2)
    const delta = (4 + Math.random() * 3) * 360 + target - (rot % 360)
    setRot((prev) => prev + delta)
    setTimeout(() => {
      setSpinning(false)
      onSpin?.(prizes[winIdx] || 'Prize')
    }, 3500)
  }

  return (
    <div className="relative cursor-pointer" style={{ width: size, height: size }} onClick={spin}>
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10">
        <div style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '14px solid #FFD700' }} />
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}
        style={{ transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 3.5s cubic-bezier(0.12,0.6,0.07,1)' : 'none' }}>
        <circle cx={cx} cy={cx} r={r + 6} fill="none" stroke="#D4AF37" strokeWidth="3" />
        {prizes.map((label, i) => {
          const a1 = i * seg, a2 = a1 + seg
          const p1 = pr(a1, r), p2 = pr(a2, r)
          const mid = pr(a1 + seg / 2, r * 0.6)
          const isO = i % 2 === 0
          return (
            <g key={i}>
              <path d={`M${cx},${cx} L${p1.x},${p1.y} A${r},${r} 0 0 1 ${p2.x},${p2.y} Z`} fill={isO ? '#F7941D' : '#1a0e00'} stroke="#2a1400" strokeWidth="0.5" />
              <text x={mid.x} y={mid.y} fill={isO ? '#1a0e00' : '#F7941D'} fontSize="7" fontWeight="bold" textAnchor="middle" dominantBaseline="central"
                transform={`rotate(${a1 + seg / 2},${mid.x},${mid.y})`}>{label.length > 10 ? label.slice(0, 9) + '…' : label}</text>
            </g>
          )
        })}
        <circle cx={cx} cy={cx} r="14" fill="#1a0e00" stroke="#D4AF37" strokeWidth="2" />
        <text x={cx} y={cx} fill="#F7941D" fontSize="12" fontWeight="900" textAnchor="middle" dominantBaseline="central">S</text>
      </svg>
    </div>
  )
}

/* ─── Deal Modal with hold-to-spin ─── */
function DealModal({ deal, onClose }: { deal: typeof SAMPLE_DEALS[0]; onClose: () => void }) {
  const [wonPrize, setWonPrize] = useState<string | null>(null)
  const [rot, setRot] = useState(0)
  const [ballA, setBallA] = useState(15)
  const [spin, setSpin] = useState(false)
  const [ballP, setBallP] = useState<'idle' | 'orbit' | 'fall' | 'settled'>('idle')
  const [pwr, setPwr] = useState(0)
  const [hold, setHold] = useState(false)
  const pwrRef = useRef(0)
  const pwrInt = useRef<ReturnType<typeof setInterval> | null>(null)

  const count = deal.prizes.length || 6
  const seg = 360 / count
  const sz = 240
  const r = sz / 2 - 16
  const cx = sz / 2

  const pr = (d: number, radius: number) => {
    const rad = ((d - 90) * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cx + radius * Math.sin(rad) }
  }

  const startH = () => {
    if (spin) return
    setHold(true); pwrRef.current = 0; setPwr(0)
    pwrInt.current = setInterval(() => { pwrRef.current = Math.min(pwrRef.current + 100 / 30, 100); setPwr(pwrRef.current) }, 100)
  }

  const releaseH = () => {
    if (!hold || spin) return
    setHold(false)
    if (pwrInt.current) { clearInterval(pwrInt.current); pwrInt.current = null }
    const p = Math.max(pwrRef.current, 15) / 100
    setPwr(0); setSpin(true); setWonPrize(null); setBallP('orbit')
    const winIdx = Math.floor(Math.random() * count)
    const target = 360 - (winIdx * seg + seg / 2)
    setRot((prev) => prev + (3 + p * 5) * 360 + target - (prev % 360))
    setBallA((prev) => prev - (4 + p * 4) * 360)
    const dur = 3000 + p * 2000
    setTimeout(() => setBallP('fall'), dur * 0.75)
    setTimeout(() => { setBallP('settled'); setSpin(false); setWonPrize(deal.prizes[winIdx]); setTimeout(() => setBallP('idle'), 3500) }, dur)
  }

  const orbitR = (r + 6) * (sz / (cx * 2))
  const settledR = r * 0.5 * (sz / (cx * 2))
  const bR = ballP === 'settled' || ballP === 'fall' ? settledR : orbitR

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative rounded-3xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto"
        style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-surface/30 hover:text-surface text-xl">&times;</button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-night text-xl" style={{ background: '#F7941D' }}>{deal.initial}</div>
          <div>
            <h3 className="font-bold text-surface text-lg">{deal.biz} — {deal.sale}</h3>
          </div>
        </div>

        {/* Hold-to-spin wheel */}
        <div className="flex justify-center">
          <div className="relative select-none" style={{ width: sz, height: sz }}
            onMouseDown={startH} onMouseUp={releaseH} onMouseLeave={() => { if (hold) releaseH() }}
            onTouchStart={startH} onTouchEnd={releaseH}>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10">
              <div style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '14px solid #FFD700' }} />
            </div>
            {/* Ball */}
            <div className="absolute inset-0 pointer-events-none z-10"
              style={{ transform: `rotate(${ballA}deg)`, transition: spin ? `transform ${ballP === 'fall' ? '0.6s' : '4.6s'} cubic-bezier(0.08,0.65,0.05,1.02)` : 'none' }}>
              <div style={{ position: 'absolute', left: '50%', top: sz / 2 - bR - 5, width: 10, height: 10, marginLeft: -5, borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 28%, #fff, #d4d4d4 45%, #999)', boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
                transition: `top ${ballP === 'fall' ? '0.5s cubic-bezier(0.36,0,0.66,-0.56)' : ballP === 'settled' ? '0.3s cubic-bezier(0.34,1.56,0.64,1)' : 'none'}` }} />
            </div>
            <svg viewBox={`0 0 ${sz} ${sz}`} width={sz} height={sz}
              style={{ transform: `rotate(${rot}deg)`, transition: spin ? 'transform 4.2s cubic-bezier(0.12,0.6,0.07,1)' : 'none' }}>
              <circle cx={cx} cy={cx} r={r + 8} fill="none" stroke="#D4AF37" strokeWidth="3" />
              {deal.prizes.map((label, i) => {
                const a1 = i * seg, a2 = a1 + seg
                const p1 = pr(a1, r), p2 = pr(a2, r), mid = pr(a1 + seg / 2, r * 0.6)
                const isO = i % 2 === 0
                return (
                  <g key={i}>
                    <path d={`M${cx},${cx} L${p1.x},${p1.y} A${r},${r} 0 0 1 ${p2.x},${p2.y} Z`} fill={isO ? '#F7941D' : '#1a0e00'} stroke="#2a1400" strokeWidth="0.5" />
                    <text x={mid.x} y={mid.y} fill={isO ? '#1a0e00' : '#F7941D'} fontSize="7" fontWeight="bold" textAnchor="middle" dominantBaseline="central"
                      transform={`rotate(${a1 + seg / 2},${mid.x},${mid.y})`}>{label.length > 10 ? label.slice(0, 9) + '…' : label}</text>
                  </g>
                )
              })}
              <circle cx={cx} cy={cx} r="14" fill="#1a0e00" stroke="#D4AF37" strokeWidth="2" />
              <text x={cx} y={cx} fill="#F7941D" fontSize="12" fontWeight="900" textAnchor="middle" dominantBaseline="central">S</text>
            </svg>
          </div>
        </div>

        {/* Power bar */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2 mb-1">
          <div className="h-full rounded-full" style={{ width: `${pwr}%`, background: pwr > 70 ? '#1D9E75' : '#F7941D', transition: hold ? 'none' : 'width 0.3s' }} />
        </div>
        <p className="text-surface/30 text-xs text-center mb-3">
          {spin ? '\u00A0' : hold ? 'Release!' : wonPrize ? 'Hold to spin again' : 'Hold and release to spin'}
        </p>

        {wonPrize && (
          <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.3)' }}>
            <p className="text-teal font-bold text-lg">You won: {wonPrize}!</p>
            <p className="text-surface/40 text-sm mt-1">Sign up to claim it</p>
            <Link href="/sign-up" className="inline-block mt-3 bg-btc text-night font-bold px-6 py-2 rounded-full text-sm hover:bg-btc-dark transition">Sign Up Free</Link>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main Page ─── */
export default function LandingPage() {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [hasSpun, setHasSpun] = useState(false)
  const [winToast, setWinToast] = useState<string | null>(null)
  const [power, setPower] = useState(0)
  const [holding, setHolding] = useState(false)
  const [modalDeal, setModalDeal] = useState<typeof SAMPLE_DEALS[0] | null>(null)
  const powerInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const powerRef = useRef(0)

  // Ball uses rAF for smooth multi-phase animation
  const ballRef = useRef<HTMLDivElement>(null)
  const ballAnimRef = useRef<number>(0)
  const SCALE = WHEEL_PX / (CX * 2)
  const BALL_SZ = 10
  const ORBIT_R = (R + 8) * SCALE  // outer rim
  const SETTLE_R = (R * 0.52) * SCALE // inside segment

  // Animate ball with requestAnimationFrame
  function animateBall(
    duration: number,
    winSegAngle: number, // angle of winning segment center in wheel's final position
  ) {
    const el = ballRef.current
    if (!el) return
    const start = performance.now()
    const halfW = WHEEL_PX / 2

    // Initial ball angle (random start)
    const startAngle = Math.random() * 360
    // Total orbit: ball spins opposite direction, more rotations
    const totalOrbitDeg = -(1800 + Math.random() * 1080) // 5-8 counter-rotations

    // The winning segment's position at the pointer (top) after wheel stops.
    // Ball must end at that angle. Pointer is at top = -90deg in standard coords.
    // The winning segment center is at the top of the wheel after rotation.
    // In the ball's coordinate system (absolute, not rotating with wheel),
    // the ball needs to land at angle = 0 (top) to match the pointer.
    // But we want it slightly offset within the segment.
    const segWidth = SEG_ANGLE
    const offsetWithinSeg = (Math.random() - 0.5) * 0.6 * segWidth // ±30% of segment
    const finalBallAngle = offsetWithinSeg // near top (0 = top under pointer)

    function tick(now: number) {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)

      // Eased progress for orbit (fast start, slow end)
      const orbitT = 1 - Math.pow(1 - t, 3) // cubic ease-out
      const angle = startAngle + totalOrbitDeg * orbitT

      // Radius: stays at orbit until 60%, then eases inward
      let radius = ORBIT_R
      if (t > 0.6) {
        const fallT = (t - 0.6) / 0.4 // 0→1 over last 40%
        // Ease with slight bounce at end
        const eased = fallT < 0.85
          ? fallT / 0.85 // linear approach
          : 1 + Math.sin((fallT - 0.85) / 0.15 * Math.PI) * 0.08 // small bounce
        radius = ORBIT_R + (SETTLE_R - ORBIT_R) * eased
      }

      // At end, blend angle toward final position
      let displayAngle = angle
      if (t > 0.85) {
        const blendT = (t - 0.85) / 0.15
        const eased = blendT * blendT * (3 - 2 * blendT) // smoothstep
        // Normalize current angle to 0-360
        const normalizedAngle = ((angle % 360) + 360) % 360
        // Find shortest path to final angle
        let diff = finalBallAngle - normalizedAngle
        if (diff > 180) diff -= 360
        if (diff < -180) diff += 360
        displayAngle = normalizedAngle + diff * eased
      }

      const rad = ((displayAngle - 90) * Math.PI) / 180
      const x = halfW + radius * Math.cos(rad) - BALL_SZ / 2
      const y = halfW + radius * Math.sin(rad) - BALL_SZ / 2

      if (!el) return
      el.style.left = `${x}px`
      el.style.top = `${y}px`

      if (t < 1) {
        ballAnimRef.current = requestAnimationFrame(tick)
      }
    }

    ballAnimRef.current = requestAnimationFrame(tick)
  }

  const startHold = useCallback(() => {
    if (spinning) return
    setHolding(true)
    powerRef.current = 0
    setPower(0)
    powerInterval.current = setInterval(() => {
      powerRef.current = Math.min(powerRef.current + 100 / 30, 100)
      setPower(powerRef.current)
    }, 100)
  }, [spinning])

  const releaseHold = useCallback(() => {
    if (!holding || spinning) return
    setHolding(false)
    if (powerInterval.current) { clearInterval(powerInterval.current); powerInterval.current = null }

    const pwr = Math.max(powerRef.current, 15) / 100
    setPower(0)
    setSpinning(true)
    setHasSpun(true)
    setWinToast(null)

    // Pick winning segment
    const winIdx = Math.floor(Math.random() * NUM_SEGMENTS)

    // Calculate exact rotation so winning segment lands under pointer (top)
    // Segment center angle = winIdx * SEG_ANGLE + SEG_ANGLE/2
    // We need this angle to be at the top (0°), so rotate wheel by -(that angle)
    // Plus random offset within ±30% of segment width
    const segCenter = winIdx * SEG_ANGLE + SEG_ANGLE / 2
    const jitter = (Math.random() - 0.5) * 0.6 * SEG_ANGLE
    const targetAngle = 360 - segCenter + jitter

    // Normalize: add full spins so total is always forward
    const fullSpins = Math.ceil(3 + pwr * 5) * 360
    // Calculate delta from current rotation
    const currentMod = ((rotation % 360) + 360) % 360
    let delta = fullSpins + targetAngle - currentMod
    if (delta < fullSpins) delta += 360 // ensure enough spins

    setRotation((prev) => prev + delta)

    const duration = 3000 + pwr * 2000

    // Animate ball with rAF
    animateBall(duration, segCenter)

    setTimeout(() => {
      setSpinning(false)
      setWinToast(PRIZES[winIdx])
      setTimeout(() => setWinToast(null), 3500)
    }, duration)
  }, [holding, spinning, rotation])

  return (
    <main className="min-h-screen bg-night flex flex-col items-center px-6 pt-12 pb-20">
      {/* ─── Roulette Wheel ─── */}
      <div
        className="relative cursor-pointer mb-1 select-none"
        style={{ width: WHEEL_PX, height: WHEEL_PX }}
        onMouseDown={startHold}
        onMouseUp={releaseHold}
        onMouseLeave={() => { if (holding) releaseHold() }}
        onTouchStart={startHold}
        onTouchEnd={releaseHold}
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
          </svg>
        </div>

        {/* Ball — positioned via requestAnimationFrame */}
        <div
          ref={ballRef}
          className="absolute pointer-events-none z-10"
          style={{
            width: BALL_SZ,
            height: BALL_SZ,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 28%, #fff, #d4d4d4 45%, #999)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.7), inset 0 -1px 2px rgba(0,0,0,0.2)',
            left: WHEEL_PX / 2 - BALL_SZ / 2,
            top: WHEEL_PX / 2 - ORBIT_R - BALL_SZ / 2,
          }}
        />

        {/* Wheel SVG */}
        <svg
          viewBox={`0 0 ${CX * 2} ${CY * 2}`}
          width={WHEEL_PX}
          height={WHEEL_PX}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4.2s cubic-bezier(0.12, 0.6, 0.07, 1)' : 'none',
          }}
        >
          <circle cx={CX} cy={CY} r={RING_R} fill="none" stroke="#D4AF37" strokeWidth="4" />
          <circle cx={CX} cy={CY} r={R + 3} fill="none" stroke="#D4AF37" strokeWidth="1" opacity="0.4" />

          {Array.from({ length: NUM_SEGMENTS }, (_, i) => {
            const p = pol(i * SEG_ANGLE, PEG_R)
            return (
              <g key={`peg-${i}`}>
                <circle cx={p.x} cy={p.y} r="4" fill="#D4AF37" />
                <circle cx={p.x} cy={p.y} r="2.5" fill="#FFD700" />
              </g>
            )
          })}

          {PRIZES.map((label, i) => {
            const isOrange = i % 2 === 0
            const midA = i * SEG_ANGLE + SEG_ANGLE / 2
            const lp = pol(midA, R * 0.62)
            return (
              <g key={`seg-${i}`}>
                <path d={slicePath(i)} fill={isOrange ? '#F7941D' : '#1a0e00'} stroke="#2a1400" strokeWidth="0.5" />
                <text x={lp.x} y={lp.y} fill={isOrange ? '#1a0e00' : '#F7941D'} fontSize="8" fontWeight="bold"
                  textAnchor="middle" dominantBaseline="central" transform={`rotate(${midA},${lp.x},${lp.y})`}>
                  {label.length > 11 ? label.slice(0, 10) + '…' : label}
                </text>
              </g>
            )
          })}

          {Array.from({ length: NUM_SEGMENTS }, (_, i) => {
            const a = i * SEG_ANGLE
            const outer = pol(a, R), inner = pol(a, INNER_R + 4)
            return <line key={`d-${i}`} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#D4AF37" strokeWidth="0.8" opacity="0.45" />
          })}

          <circle cx={CX} cy={CY} r={INNER_R + 2} fill="#1a0e00" stroke="#D4AF37" strokeWidth="2.5" />
          <circle cx={CX} cy={CY} r={INNER_R - 4} fill="#1a0e00" stroke="#F7941D" strokeWidth="0.5" opacity="0.3" />
          <text x={CX} y={CY} fill="#F7941D" fontSize="26" fontWeight="900" textAnchor="middle" dominantBaseline="central" fontFamily="Arial Black, Arial, sans-serif">S</text>
        </svg>
      </div>

      {/* Power meter */}
      <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden mb-2 mt-1">
        <div className="h-full rounded-full" style={{ width: `${power}%`, background: power > 70 ? '#1D9E75' : '#F7941D', transition: holding ? 'none' : 'width 0.3s' }} />
      </div>
      <p className="text-surface/30 text-xs mb-6 tracking-wide">
        {spinning ? '\u00A0' : holding ? 'Release to spin!' : hasSpun ? 'Hold to spin again' : 'Hold and release to spin'}
      </p>

      {/* Win toast */}
      {winToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg animate-bounce" style={{ background: '#F7941D', color: '#1a0e00' }}>
          <span className="font-black text-lg">You won: {winToast}!</span>
        </div>
      )}

      {/* Logo */}
      <div className="mb-3 flex flex-col items-end">
        <div style={{ fontSize: '2.5rem', lineHeight: 1, fontWeight: 900 }} className="font-display">
          <span className="text-btc">S</span><span className="text-surface">erendip</span>
        </div>
        <div className="font-display" style={{ fontSize: '2.3rem', lineHeight: 1, fontWeight: 900, transform: 'rotate(180deg)',
          background: 'linear-gradient(to right, transparent, #F7941D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginTop: '-0.1rem' }}>
          Eatery
        </div>
      </div>

      <p className="text-lg md:text-xl font-bold tracking-wider text-surface/50 mb-10">Spin. Win. Connect. Eat.</p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md mb-14">
        <Link href="/consumer" className="w-full sm:w-auto flex-1 bg-btc text-night font-bold text-lg px-8 py-4 rounded-full text-center hover:bg-btc-dark transition">I want deals</Link>
        <Link href="/business" className="w-full sm:w-auto flex-1 border-2 border-surface/20 text-surface/70 font-bold text-lg px-8 py-4 rounded-full text-center hover:border-surface/40 hover:text-surface transition">I have a business</Link>
      </div>

      {/* ─── How It Works Icons ─── */}
      <div className="flex items-center justify-center gap-10 md:gap-16 mb-10">
        {/* Spin: mini roulette wheel */}
        <div className="flex flex-col items-center gap-2">
          <svg width="36" height="36" viewBox="0 0 36 36">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a1 = i * 60, a2 = a1 + 60
              const r1 = ((a1 - 90) * Math.PI) / 180, r2 = ((a2 - 90) * Math.PI) / 180
              return <path key={i} d={`M18,18 L${18 + 14 * Math.cos(r1)},${18 + 14 * Math.sin(r1)} A14,14 0 0 1 ${18 + 14 * Math.cos(r2)},${18 + 14 * Math.sin(r2)} Z`}
                fill={i % 2 === 0 ? '#F7941D' : '#1a0e00'} stroke="#2a1400" strokeWidth="0.5" />
            })}
            <circle cx="18" cy="18" r="14.5" fill="none" stroke="#D4AF37" strokeWidth="1.5" />
            <circle cx="18" cy="18" r="4" fill="#1a0e00" stroke="#D4AF37" strokeWidth="1" />
          </svg>
          <span className="text-surface/50 text-xs font-bold">Spin</span>
        </div>
        {/* Win: gift box */}
        <div className="flex flex-col items-center gap-2">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <rect x="6" y="16" width="24" height="14" rx="2" fill="none" stroke="#F7941D" strokeWidth="2" />
            <rect x="4" y="12" width="28" height="6" rx="2" fill="none" stroke="#F7941D" strokeWidth="2" />
            <line x1="18" y1="12" x2="18" y2="30" stroke="#F7941D" strokeWidth="2" />
            <path d="M18,12 C18,8 14,6 12,8 C10,10 12,12 18,12" fill="none" stroke="#F7941D" strokeWidth="1.5" />
            <path d="M18,12 C18,8 22,6 24,8 C26,10 24,12 18,12" fill="none" stroke="#F7941D" strokeWidth="1.5" />
          </svg>
          <span className="text-surface/50 text-xs font-bold">Win</span>
        </div>
        {/* Connect: scissors hand */}
        <div className="flex flex-col items-center gap-2">
          <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(-45deg)' }}>
            <text x="18" y="20" textAnchor="middle" dominantBaseline="central" fontSize="26">✌️</text>
          </svg>
          <span className="text-surface/50 text-xs font-bold">Connect</span>
        </div>
        {/* Eat: plate with fork */}
        <div className="flex flex-col items-center gap-2">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="13" fill="none" stroke="#F7941D" strokeWidth="2" />
            <circle cx="18" cy="18" r="9" fill="none" stroke="#F7941D" strokeWidth="0.5" opacity="0.3" />
            <line x1="12" y1="8" x2="12" y2="28" stroke="#F7941D" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="8" x2="9" y2="14" stroke="#F7941D" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="15" y1="8" x2="15" y2="14" stroke="#F7941D" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="14" x2="15" y2="14" stroke="#F7941D" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-surface/50 text-xs font-bold">Eat</span>
        </div>
      </div>

      {/* Live challenge card */}
      <div
        className="w-full max-w-lg rounded-2xl p-6 mb-6 text-center animate-[challengePulse_2s_ease-in-out_infinite]"
        style={{ background: '#1a1230' }}
      >
        <p className="text-3xl mb-3">✌️</p>
        <h3 className="text-xl font-black text-surface mb-1">RPS Challenge Dropped</h3>
        <p className="text-surface/50 text-sm mb-5">Someone nearby dropped a challenge. Accept or back down.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/battle/demo" className="bg-btc text-night font-bold px-6 py-3 rounded-full hover:bg-btc-dark transition text-sm">
            Accept Challenge
          </Link>
          <button className="border border-surface/20 text-surface/40 font-bold px-6 py-3 rounded-full text-sm hover:text-surface/60 transition">
            Back Down
          </button>
        </div>
      </div>

      {/* Drop a Challenge button */}
      <button
        onClick={() => {
          const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/battle/demo`
          const shareData = { title: 'SerendipEatery RPS Challenge', text: "I just dropped a Rock Paper Scissors challenge at SerendipEatery. Winner takes deals. You in? 👊", url }
          if (typeof navigator !== 'undefined' && navigator.share) {
            navigator.share(shareData).catch(() => {})
          } else if (typeof navigator !== 'undefined') {
            navigator.clipboard.writeText(url)
          }
        }}
        className="bg-btc/10 text-btc font-bold px-8 py-3 rounded-full text-sm border border-btc/30 hover:bg-btc/20 transition mb-14"
      >
        ✌️ Drop a Challenge
      </button>

      <style>{`
        @keyframes challengePulse {
          0%, 100% { border: 2px solid rgba(247,148,29,0.15); }
          50% { border: 2px solid rgba(247,148,29,0.5); box-shadow: 0 0 20px rgba(247,148,29,0.1); }
        }
      `}</style>

      {/* ─── Clickable Deal Cards ─── */}
      <div className="w-full max-w-3xl">
        <h2 className="text-xl font-bold text-surface mb-4">Flash sales near you</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SAMPLE_DEALS.map((deal) => (
            <div
              key={deal.biz}
              className={`rounded-2xl p-5 ${deal.soon ? '' : 'cursor-pointer hover:border-btc/30'} transition`}
              style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.12)' }}
              onClick={() => { if (!deal.soon) setModalDeal(deal) }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-night shrink-0" style={{ background: '#F7941D' }}>{deal.initial}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-surface text-base truncate">{deal.biz}</h3>
                  <p className="text-surface/40 text-sm">{deal.sale}</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: deal.soon ? 'rgba(83,74,183,0.2)' : 'rgba(29,158,117,0.15)', color: deal.soon ? '#534AB7' : '#1D9E75' }}>
                  {deal.status}
                </span>
              </div>
              <button className={`block w-full text-center py-2.5 rounded-full text-sm font-bold transition ${deal.soon ? 'border border-surface/15 text-surface/40' : 'bg-btc text-night hover:bg-btc-dark'}`}>
                {deal.soon ? 'Coming Soon' : 'Spin to Win'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Deal modal */}
      {modalDeal && <DealModal deal={modalDeal} onClose={() => setModalDeal(null)} />}

      {/* App download */}
      <div className="flex items-center gap-4 mt-12">
        <Link href="/coming-soon-app" className="border border-surface/20 text-surface/50 text-sm px-5 py-2 rounded-full hover:border-surface/40 hover:text-surface/70 transition">Download for iOS</Link>
        <Link href="/coming-soon-app" className="border border-surface/20 text-surface/50 text-sm px-5 py-2 rounded-full hover:border-surface/40 hover:text-surface/70 transition">Download for Android</Link>
      </div>

      {/* Footer */}
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
