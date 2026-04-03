'use client'

import { useState, useCallback, useRef } from 'react'

/* ─── Shared Roulette Wheel ───
   Winning segment lands at BOTTOM (6 o'clock / 270°).
   Ball always settles at bottom = guaranteed alignment.
*/

export interface WheelPrize {
  label: string
  weight: number
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
const R = 130
const CX = 160
const INNER_R = 26
const BALL_SZ = 10
const ORBIT_R = (R + 10) * (WHL / (CX * 2))
const POCKET_R = (R * 0.55) * (WHL / (CX * 2))

function pol(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CX + r * Math.sin(rad) }
}

function buildSegments(prizes: WheelPrize[]) {
  const total = prizes.reduce((s, p) => s + p.weight, 0)
  let cum = 0
  return prizes.map((p) => {
    const start = cum
    const sweep = (p.weight / total) * 360
    cum += sweep
    return { ...p, start, sweep, mid: start + sweep / 2 }
  })
}

function slicePath(start: number, sweep: number) {
  const p1 = pol(start, R)
  const p2 = pol(start + sweep, R)
  const large = sweep > 180 ? 1 : 0
  return `M${CX},${CX} L${p1.x},${p1.y} A${R},${R} 0 ${large} 1 ${p2.x},${p2.y} Z`
}

export function RouletteWheel({
  prizes = DEFAULT_PRIZES,
  onSpinComplete,
}: {
  prizes?: WheelPrize[]
  onSpinComplete?: (prize: WheelPrize, index: number) => void
}) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [power, setPower] = useState(0)
  const [holding, setHolding] = useState(false)
  const [hasSpun, setHasSpun] = useState(false)
  const ballRef = useRef<HTMLDivElement>(null)
  const ballAnimRef = useRef(0)
  const pwrInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const pwrRef = useRef(0)

  const segments = buildSegments(prizes)

  const startHold = useCallback(() => {
    if (spinning) return
    setHolding(true)
    pwrRef.current = 0
    setPower(0)
    pwrInterval.current = setInterval(() => {
      pwrRef.current = Math.min(pwrRef.current + 100 / 30, 100)
      setPower(pwrRef.current)
    }, 100)
  }, [spinning])

  function animateBall(duration: number) {
    const el = ballRef.current
    if (!el) return
    const start = performance.now()
    const halfW = WHL / 2
    const startAngle = Math.random() * 360
    const fullSpins = 5 + Math.floor(Math.random() * 3)
    // Ball always ends at 270° (bottom / 6 o'clock)
    const finalAngle = 270
    const totalOrbit = -(fullSpins * 360 + finalAngle - startAngle)

    function easeOut(t: number) { return 1 - Math.pow(1 - t, 3) }

    function tick(now: number) {
      if (!el) return
      const t = Math.min((now - start) / duration, 1)
      const angle = startAngle + totalOrbit * easeOut(t)

      let radius = ORBIT_R
      if (t > 0.85) {
        const d = Math.min((t - 0.85) / 0.10, 1)
        radius = ORBIT_R + (POCKET_R - ORBIT_R) * d
      }

      let bounce = 0
      if (t > 0.95) {
        bounce = Math.sin((t - 0.95) * 20 * Math.PI) * (1 - t) * 8
      }

      const rad = ((angle - 90) * Math.PI) / 180
      const fr = radius + bounce
      el.style.left = `${halfW + fr * Math.cos(rad) - BALL_SZ / 2}px`
      el.style.top = `${halfW + fr * Math.sin(rad) - BALL_SZ / 2}px`

      if (t < 1) ballAnimRef.current = requestAnimationFrame(tick)
    }

    ballAnimRef.current = requestAnimationFrame(tick)
  }

  const releaseHold = useCallback(() => {
    if (!holding || spinning) return
    setHolding(false)
    if (pwrInterval.current) { clearInterval(pwrInterval.current); pwrInterval.current = null }

    const pwr = Math.max(pwrRef.current, 15) / 100
    setPower(0)
    setSpinning(true)
    setHasSpun(true)

    // Weighted random winner
    const total = prizes.reduce((s, p) => s + p.weight, 0)
    let rand = Math.random() * total, winIdx = 0
    for (let i = 0; i < prizes.length; i++) {
      rand -= prizes[i].weight
      if (rand <= 0) { winIdx = i; break }
    }

    // Rotate wheel so winning segment lands at BOTTOM (270°)
    // Segment center in wheel coordinates = seg.mid
    // We need seg.mid to be at 270° after rotation
    // finalRotation mod 360 = 270 - seg.mid
    const seg = segments[winIdx]
    const jitter = (Math.random() - 0.5) * 0.5 * seg.sweep
    const targetAngle = 270 - seg.mid + jitter
    const fullSpins = Math.ceil(3 + pwr * 5) * 360
    const curMod = ((rotation % 360) + 360) % 360
    let delta = fullSpins + targetAngle - curMod
    if (delta < fullSpins) delta += 360

    setRotation((prev) => prev + delta)

    const duration = 3000 + pwr * 2000
    animateBall(duration)

    setTimeout(() => {
      setSpinning(false)
      onSpinComplete?.(prizes[winIdx], winIdx)
    }, duration)
  }, [holding, spinning, rotation, prizes, segments, onSpinComplete])

  return (
    <div className="relative">
      <div
        className="relative cursor-pointer select-none mx-auto"
        style={{ width: WHL, height: WHL }}
        onMouseDown={startHold}
        onMouseUp={releaseHold}
        onMouseLeave={() => { if (holding) releaseHold() }}
        onTouchStart={startHold}
        onTouchEnd={releaseHold}
      >
        {/* Ball */}
        <div
          ref={ballRef}
          className="absolute pointer-events-none z-10"
          style={{
            width: BALL_SZ, height: BALL_SZ, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 28%, #fff, #d4d4d4 45%, #999)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
            left: WHL / 2 - BALL_SZ / 2,
            top: WHL / 2 - ORBIT_R - BALL_SZ / 2,
          }}
        />

        {/* Wheel SVG */}
        <svg
          viewBox={`0 0 ${CX * 2} ${CX * 2}`}
          width={WHL}
          height={WHL}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4.2s cubic-bezier(0.12,0.6,0.07,1)' : 'none',
          }}
        >
          {/* Outer gold ring */}
          <circle cx={CX} cy={CX} r={R + 14} fill="none" stroke="#FFD700" strokeWidth="3" />

          {/* Metallic bumps */}
          {segments.map((seg, i) => {
            const p = pol(seg.start, R + 8)
            return <circle key={`b-${i}`} cx={p.x} cy={p.y} r="3.5" fill="#FFD700" />
          })}

          {/* Weighted segments */}
          {segments.map((seg, i) => {
            const lp = pol(seg.mid, R * 0.58)
            const dark = seg.color === '#2a2a2a' || seg.color === '#9400D3' || seg.color === '#4169E1'
            return (
              <g key={`s-${i}`}>
                <path d={slicePath(seg.start, seg.sweep)} fill={seg.color} stroke="#FFD700" strokeWidth="1" />
                <text
                  x={lp.x} y={lp.y}
                  fill={dark ? '#fff' : '#1a0e00'}
                  fontSize={seg.sweep < 20 ? '5.5' : '7.5'}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${seg.mid},${lp.x},${lp.y})`}
                >
                  {seg.label.length > 10 ? seg.label.slice(0, 9) + '…' : seg.label}
                </text>
              </g>
            )
          })}

          {/* Center hub */}
          <circle cx={CX} cy={CX} r={INNER_R + 2} fill="#1a0e00" stroke="#FFD700" strokeWidth="2" />
          <text x={CX} y={CX} fill="#FFD700" fontSize="20" fontWeight="900" textAnchor="middle" dominantBaseline="central" fontFamily="Arial Black,sans-serif">S</text>
        </svg>
      </div>

      {/* Power meter */}
      <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden mx-auto mt-2 mb-1">
        <div className="h-full rounded-full" style={{ width: `${power}%`, background: power > 70 ? '#1D9E75' : '#F7941D', transition: holding ? 'none' : 'width 0.3s' }} />
      </div>
      <p className="text-center text-xs mb-4" style={{ color: 'rgba(255,248,242,0.3)' }}>
        {spinning ? '\u00A0' : holding ? 'Release to spin!' : hasSpun ? 'Hold to spin again' : 'Hold and release to spin'}
      </p>
    </div>
  )
}
