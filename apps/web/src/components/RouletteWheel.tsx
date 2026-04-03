'use client'

import { useState, useCallback, useRef } from 'react'

/**
 * RouletteWheel — SINGLE shared component used everywhere.
 *
 * Coordinate system:
 *   SVG viewBox: 0 0 400 400, center at (200, 200)
 *   Angle 0 = RIGHT (3 o'clock), increases CLOCKWISE (standard SVG)
 *   Segment 0 starts at 0° (3 o'clock)
 *
 * Winning alignment:
 *   Wheel rotates so winning segment lands at TOP (12 o'clock = -90° CSS)
 *   Ball ALWAYS ends at TOP (fixed screen position)
 *   Ball at top + winning segment at top = guaranteed match
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

// ─── Constants ──────────────────────────────────────────────────────────────
const VB = 400              // viewBox size
const CX = 200              // center
const CY = 200
const R = 170               // wheel radius
const INNER_R = 35          // center hub radius
const POCKET_R = R * 0.65   // where ball settles (inside segments)
const OUTER_ORBIT = R + 15  // ball orbit outside wheel
const BALL_SZ = 12
const DISPLAY_SIZE = 340    // rendered pixel size
const SCALE = DISPLAY_SIZE / VB

// ─── Segment geometry ───────────────────────────────────────────────────────
function buildSegments(prizes: WheelPrize[]) {
  const total = prizes.reduce((s, p) => s + p.weight, 0)
  let cum = 0
  return prizes.map((p) => {
    const startRad = (cum / total) * 2 * Math.PI
    cum += p.weight
    const endRad = (cum / total) * 2 * Math.PI
    const midRad = (startRad + endRad) / 2
    const sweepDeg = (p.weight / total) * 360
    const startDeg = ((cum - p.weight) / total) * 360
    return { ...p, startRad, endRad, midRad, startDeg, sweepDeg }
  })
}

function segmentPath(startRad: number, endRad: number) {
  const x1 = CX + R * Math.cos(startRad)
  const y1 = CY + R * Math.sin(startRad)
  const x2 = CX + R * Math.cos(endRad)
  const y2 = CY + R * Math.sin(endRad)
  const large = (endRad - startRad) > Math.PI ? 1 : 0
  return `M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} Z`
}

// ─── Component ──────────────────────────────────────────────────────────────
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
  const rafRef = useRef(0)
  const pwrRef = useRef(0)
  const pwrInt = useRef<ReturnType<typeof setInterval> | null>(null)

  const segments = buildSegments(prizes)

  // ─── Hold to charge power ───────────────────────────────────────────
  const startHold = useCallback(() => {
    if (spinning) return
    setHolding(true)
    pwrRef.current = 0
    setPower(0)
    pwrInt.current = setInterval(() => {
      pwrRef.current = Math.min(pwrRef.current + 100 / 30, 100)
      setPower(pwrRef.current)
    }, 100)
  }, [spinning])

  // ─── Ball animation (rAF) ──────────────────────────────────────────
  function animateBall(duration: number) {
    const el = ballRef.current
    if (!el) return
    const start = performance.now()
    const halfPx = DISPLAY_SIZE / 2

    // Ball starts at top, orbits outward then returns to top
    const orbitPx = OUTER_ORBIT * SCALE
    const pocketPx = POCKET_R * SCALE
    const startAngle = -Math.PI / 2 // top = -90°
    const totalRevolutions = -(5 + Math.random() * 3) * 2 * Math.PI // counter-clockwise

    function easeOut(t: number) { return 1 - Math.pow(1 - t, 3) }

    function tick(now: number) {
      if (!el) return
      const t = Math.min((now - start) / duration, 1)

      // Orbit angle: starts at top, sweeps counter-clockwise, ends back at top
      // We add totalRevolutions but bias the end toward -π/2 (top)
      const orbitProgress = easeOut(t)
      const angle = startAngle + totalRevolutions * orbitProgress
      // At t=1, angle = startAngle + totalRevolutions (some multiple of 2π away from start)
      // We want it to end at -π/2. totalRevolutions is already calculated to be full loops,
      // so the fractional part brings it back near startAngle.

      // Radius: outer orbit until t=0.85, then lerp to pocket, ends at pocket at top
      let radius: number
      if (t < 0.85) {
        radius = orbitPx
      } else if (t < 0.95) {
        const d = (t - 0.85) / 0.10
        radius = orbitPx + (pocketPx - orbitPx) * d
      } else {
        radius = pocketPx
      }

      // Bounce at end (t > 0.95)
      let bounce = 0
      if (t > 0.95) {
        bounce = Math.sin((t - 0.95) * 20 * Math.PI) * (1 - t) * 6
      }

      // At t >= 0.95, force angle toward -π/2 (top)
      let finalAngle = angle
      if (t > 0.90) {
        const blend = Math.min((t - 0.90) / 0.10, 1)
        // Smoothstep blend
        const s = blend * blend * (3 - 2 * blend)
        // Normalize angle to find nearest -π/2 equivalent
        const targetAngle = -Math.PI / 2
        const norm = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
        let target = targetAngle
        // Find the closest -π/2 + 2πn to current angle
        while (target < angle - Math.PI) target += 2 * Math.PI
        while (target > angle + Math.PI) target -= 2 * Math.PI
        finalAngle = angle + (target - angle) * s
      }

      const fr = radius + bounce
      const bx = halfPx + fr * Math.cos(finalAngle) - BALL_SZ / 2
      const by = halfPx + fr * Math.sin(finalAngle) - BALL_SZ / 2

      el.style.left = `${bx}px`
      el.style.top = `${by}px`

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // Snap ball to exact top-center pocket position
        el.style.left = `${halfPx - BALL_SZ / 2}px`
        el.style.top = `${halfPx - pocketPx - BALL_SZ / 2}px`
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  // ─── Release to spin ────────────────────────────────────────────────
  const releaseHold = useCallback(() => {
    if (!holding || spinning) return
    setHolding(false)
    if (pwrInt.current) { clearInterval(pwrInt.current); pwrInt.current = null }

    const pwr = Math.max(pwrRef.current, 15) / 100
    setPower(0)
    setSpinning(true)
    setHasSpun(true)

    // Pick winner using weighted random
    const total = prizes.reduce((s, p) => s + p.weight, 0)
    let rand = Math.random() * total
    let winIdx = 0
    for (let i = 0; i < prizes.length; i++) {
      rand -= prizes[i].weight
      if (rand <= 0) { winIdx = i; break }
    }

    // STEP 4: Calculate rotation to land winning segment at TOP (-90° CSS)
    // Segment center in wheel coordinates (degrees from 3 o'clock, clockwise)
    const seg = segments[winIdx]
    const winCenterDeg = seg.startDeg + seg.sweepDeg / 2

    // To bring this segment to top (which is -90° in CSS rotation terms):
    // We need to rotate the wheel so that winCenterDeg aligns with -90° (top)
    // CSS rotate(X) rotates clockwise. To put winCenterDeg at top:
    // rotationNeeded = -90 - winCenterDeg (mod 360)
    const targetMod = ((-90 - winCenterDeg) % 360 + 360) % 360

    // Add jitter within segment (±30% of sweep)
    const jitter = (Math.random() - 0.5) * 0.6 * seg.sweepDeg

    // Add full spins
    const fullSpins = Math.ceil(3 + pwr * 5) * 360
    const curMod = ((rotation % 360) + 360) % 360
    let delta = fullSpins + targetMod + jitter - curMod
    if (delta < fullSpins) delta += 360

    setRotation((prev) => prev + delta)

    const duration = 3000 + pwr * 2000
    animateBall(duration)

    setTimeout(() => {
      setSpinning(false)
      console.log('Winner index:', winIdx, 'Prize:', prizes[winIdx].label, 'Wheel rotated to:', (rotation + delta) % 360, 'degrees')
      onSpinComplete?.(prizes[winIdx], winIdx)
    }, duration)
  }, [holding, spinning, rotation, prizes, segments, onSpinComplete])

  // ─── Ball initial position: top of wheel, inside pocket ─────────────
  const ballInitX = DISPLAY_SIZE / 2 - BALL_SZ / 2
  const ballInitY = DISPLAY_SIZE / 2 - OUTER_ORBIT * SCALE - BALL_SZ / 2

  return (
    <div className="relative">
      <div
        className="relative cursor-pointer select-none mx-auto"
        style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
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
            left: ballInitX, top: ballInitY,
          }}
        />

        {/* Wheel SVG */}
        <svg
          viewBox={`0 0 ${VB} ${VB}`}
          width={DISPLAY_SIZE}
          height={DISPLAY_SIZE}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4.2s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
          }}
        >
          {/* Outer gold ring */}
          <circle cx={CX} cy={CY} r={R + 10} fill="none" stroke="#FFD700" strokeWidth="3" />

          {/* Bumps at segment boundaries */}
          {segments.map((seg, i) => {
            const bx = CX + (R + 6) * Math.cos(seg.startRad)
            const by = CY + (R + 6) * Math.sin(seg.startRad)
            return <circle key={`bump-${i}`} cx={bx} cy={by} r="3.5" fill="#FFD700" />
          })}

          {/* Segments */}
          {segments.map((seg, i) => {
            const lx = CX + R * 0.55 * Math.cos(seg.midRad)
            const ly = CY + R * 0.55 * Math.sin(seg.midRad)
            const midDeg = (seg.startDeg + seg.sweepDeg / 2)
            const isDark = seg.color === '#2a2a2a' || seg.color === '#9400D3' || seg.color === '#4169E1'
            return (
              <g key={`seg-${i}`}>
                <path d={segmentPath(seg.startRad, seg.endRad)} fill={seg.color} stroke="#FFD700" strokeWidth="1" />
                <text
                  x={lx} y={ly}
                  fill={isDark ? '#fff' : '#1a0e00'}
                  fontSize={seg.sweepDeg < 20 ? '8' : '11'}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${midDeg},${lx},${ly})`}
                >
                  {seg.label.length > 10 ? seg.label.slice(0, 9) + '…' : seg.label}
                </text>
              </g>
            )
          })}

          {/* Center hub */}
          <circle cx={CX} cy={CY} r={INNER_R + 2} fill="#1a0e00" stroke="#FFD700" strokeWidth="2.5" />
          <text x={CX} y={CY} fill="#FFD700" fontSize="28" fontWeight="900" textAnchor="middle" dominantBaseline="central" fontFamily="Arial Black,sans-serif">S</text>
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
