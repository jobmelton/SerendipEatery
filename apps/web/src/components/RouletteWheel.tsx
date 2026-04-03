'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

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

// ─── Physics constants ───────────────────────────────────────────────────
const SIZE = 340
const VB = 400
const CX = 200
const CY = 200
const R = 170
const INNER_R = 32
const BALL_SZ = 12

const SPIN_DURATION = 5000        // 5s total
const FULL_ROTATIONS = 5
const EASE_POWER = 3
const BALL_ORBIT_RADIUS = 115     // px (screen space)
const BALL_POCKET_RADIUS = 88     // px (screen space) — where ball settles
const DRIFT_START = 0.75          // 75% of animation
const SETTLE_START = 0.90         // 90% of animation
const BOUNCE_AMOUNT = 8           // px
const BOUNCE_COUNT = 3
const BALL_SPEED_MULT = 1.3

function easeOut(t: number, power = 3): number {
  return 1 - Math.pow(1 - t, power)
}

export function RouletteWheel({
  prizes = DEFAULT_PRIZES,
  onSpinComplete,
}: {
  prizes?: WheelPrize[]
  onSpinComplete?: (prize: WheelPrize, index: number) => void
}) {
  const [spinning, setSpinning] = useState(false)
  const [power, setPower] = useState(0)
  const [holding, setHolding] = useState(false)
  const [hasSpun, setHasSpun] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animRef = useRef<number>(0)
  const wheelRotRef = useRef(0)
  const stateRef = useRef<{
    animating: boolean
    startTime: number
    wheelStart: number
    totalWheelRot: number
    winIdx: number
    ballStartAngle: number
    totalBallRot: number
    finalBallX: number
    finalBallY: number
  } | null>(null)

  const N = prizes.length
  const DEG = 360 / N
  const scale = SIZE / VB

  // ─── Segment SVG path ──────────────────────────────────────────────
  function segPath(i: number) {
    const startRad = (i * DEG - 90) * Math.PI / 180
    const endRad = ((i + 1) * DEG - 90) * Math.PI / 180
    const x1 = CX + R * Math.cos(startRad)
    const y1 = CY + R * Math.sin(startRad)
    const x2 = CX + R * Math.cos(endRad)
    const y2 = CY + R * Math.sin(endRad)
    return `M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${DEG > 180 ? 1 : 0} 1 ${x2},${y2} Z`
  }

  function labelPos(i: number) {
    const midDeg = i * DEG + DEG / 2
    const midRad = (midDeg - 90) * Math.PI / 180
    const lr = R * 0.58
    return { x: CX + lr * Math.cos(midRad), y: CY + lr * Math.sin(midRad), deg: midDeg }
  }

  // ─── Ball position (screen-space px relative to wheel center) ──────
  const ballPosRef = useRef({ x: SIZE / 2, y: SIZE / 2 + BALL_POCKET_RADIUS })

  const computeBallPos = useCallback((t: number) => {
    const s = stateRef.current
    if (!s) return { x: SIZE / 2, y: SIZE / 2 + BALL_POCKET_RADIUS }

    const cx = SIZE / 2
    const cy = SIZE / 2

    if (t >= 1) {
      return { x: s.finalBallX, y: s.finalBallY }
    }

    if (t < DRIFT_START) {
      // ORBIT phase: ball spins on outer rim in screen space
      const ballAngle = s.ballStartAngle + s.totalBallRot * easeOut(t / DRIFT_START, 1.2)
      return {
        x: cx + BALL_ORBIT_RADIUS * Math.cos(ballAngle),
        y: cy + BALL_ORBIT_RADIUS * Math.sin(ballAngle),
      }
    }

    if (t < SETTLE_START) {
      // DRIFT phase: ball moves from last orbit to final pocket
      const p = (t - DRIFT_START) / (SETTLE_START - DRIFT_START)
      const lastAngle = s.ballStartAngle + s.totalBallRot * easeOut(1, 1.2) // easeOut at driftT=1 (full drift)
      // Recalc: use driftT normalized
      const lastAngleActual = s.ballStartAngle + s.totalBallRot * easeOut(DRIFT_START / DRIFT_START, 1.2)
      const lastX = cx + BALL_ORBIT_RADIUS * Math.cos(lastAngleActual)
      const lastY = cy + BALL_ORBIT_RADIUS * Math.sin(lastAngleActual)
      return {
        x: lastX + (s.finalBallX - lastX) * easeOut(p, 2),
        y: lastY + (s.finalBallY - lastY) * easeOut(p, 2),
      }
    }

    // SETTLE phase: ball rattles left-right at pocket position
    const p = (t - SETTLE_START) / (1 - SETTLE_START)
    const decay = 1 - p
    const rattle = Math.sin(p * Math.PI * BOUNCE_COUNT) * decay * BOUNCE_AMOUNT
    return {
      x: s.finalBallX + rattle,
      y: s.finalBallY,
    }
  }, [])

  // ─── Animation loop ────────────────────────────────────────────────
  const [wheelDeg, setWheelDeg] = useState(0)
  const [ballPos, setBallPos] = useState({ x: SIZE / 2, y: SIZE / 2 + BALL_POCKET_RADIUS })

  const animate = useCallback(() => {
    const s = stateRef.current
    if (!s || !s.animating) return

    const elapsed = Date.now() - s.startTime
    const t = Math.min(elapsed / SPIN_DURATION, 1)

    // Wheel rotation
    const currentRot = s.wheelStart + s.totalWheelRot * easeOut(t, EASE_POWER)
    setWheelDeg(currentRot)
    wheelRotRef.current = currentRot

    // Ball position
    const bp = computeBallPos(t)
    setBallPos(bp)
    ballPosRef.current = bp

    if (t < 1) {
      animRef.current = requestAnimationFrame(animate)
    } else {
      // Animation complete
      s.animating = false
      setSpinning(false)
      onSpinComplete?.(prizes[s.winIdx], s.winIdx)
    }
  }, [computeBallPos, onSpinComplete, prizes])

  // ─── Power bar: hold to charge ─────────────────────────────────────
  function startHold() {
    if (spinning) return
    setHolding(true)
    setPower(0)
    intervalRef.current = setInterval(() => {
      setPower(prev => {
        if (prev >= 100) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          return 100
        }
        return prev + 2
      })
    }, 50)
  }

  function endHold() {
    if (!holding) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    setHolding(false)
    const currentPower = power
    setPower(0)

    if (spinning) return
    setSpinning(true)
    setHasSpun(true)

    // Pick winner (weighted random)
    const total = prizes.reduce((s, p) => s + p.weight, 0)
    let rand = Math.random() * total
    let winIdx = 0
    for (let i = 0; i < N; i++) {
      rand -= prizes[i].weight
      if (rand <= 0) { winIdx = i; break }
    }

    // Calculate wheel rotation so winIdx lands at BOTTOM (6 o'clock)
    const segCenter = winIdx * DEG + DEG / 2
    const targetAngle = 180 - segCenter
    const currentMod = ((wheelRotRef.current % 360) + 360) % 360
    const totalWheelRot = FULL_ROTATIONS * 360 + ((targetAngle - currentMod) + 360) % 360

    // Ball: starts at 12 o'clock, spins opposite direction
    const ballStartAngle = -Math.PI / 2
    const totalBallRot = -(FULL_ROTATIONS * BALL_SPEED_MULT * 2 * Math.PI)

    // Final ball position: bottom center (in screen pixels)
    const finalBallX = SIZE / 2
    const finalBallY = SIZE / 2 + BALL_POCKET_RADIUS

    stateRef.current = {
      animating: true,
      startTime: Date.now(),
      wheelStart: wheelRotRef.current,
      totalWheelRot,
      winIdx,
      ballStartAngle,
      totalBallRot,
      finalBallX,
      finalBallY,
    }

    animRef.current = requestAnimationFrame(animate)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <div className="relative">
      <div
        className="relative cursor-pointer select-none mx-auto"
        style={{ width: SIZE, height: SIZE }}
        onMouseDown={startHold}
        onMouseUp={endHold}
        onMouseLeave={endHold}
        onTouchStart={startHold}
        onTouchEnd={endHold}
      >
        {/* Ball — positioned in screen space, does NOT rotate with wheel */}
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            width: BALL_SZ,
            height: BALL_SZ,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 28%, #fff, #d4d4d4 45%, #999)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
            left: ballPos.x - BALL_SZ / 2,
            top: ballPos.y - BALL_SZ / 2,
          }}
        />

        {/* Wheel SVG */}
        <svg
          viewBox={`0 0 ${VB} ${VB}`}
          width={SIZE}
          height={SIZE}
          style={{
            transform: `rotate(${wheelDeg}deg)`,
          }}
        >
          <circle cx={CX} cy={CY} r={R + 10} fill="none" stroke="#FFD700" strokeWidth="3" />

          {prizes.map((_, i) => {
            const a = (i * DEG - 90) * Math.PI / 180
            return <circle key={`b${i}`} cx={CX + (R + 6) * Math.cos(a)} cy={CY + (R + 6) * Math.sin(a)} r="3.5" fill="#FFD700" />
          })}

          {prizes.map((p, i) => {
            const lp = labelPos(i)
            const dark = p.color === '#2a2a2a' || p.color === '#9400D3' || p.color === '#4169E1'
            return (
              <g key={`s${i}`}>
                <path d={segPath(i)} fill={p.color} stroke="#FFD700" strokeWidth="1" />
                <text x={lp.x} y={lp.y} fill={dark ? '#fff' : '#1a0e00'}
                  fontSize={DEG < 25 ? '8' : '11'} fontWeight="bold" textAnchor="middle" dominantBaseline="central"
                  transform={`rotate(${lp.deg},${lp.x},${lp.y})`}>
                  {p.label.length > 10 ? p.label.slice(0, 9) + '…' : p.label}
                </text>
              </g>
            )
          })}

          <circle cx={CX} cy={CY} r={INNER_R + 2} fill="#1a0e00" stroke="#FFD700" strokeWidth="2.5" />
          <text x={CX} y={CY} fill="#FFD700" fontSize="26" fontWeight="900" textAnchor="middle" dominantBaseline="central" fontFamily="Arial Black,sans-serif">S</text>
        </svg>
      </div>

      {/* Power bar */}
      <div className="flex justify-center mt-2 mb-1">
        <div style={{ width: 200, height: 12, background: '#1a0e00', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${power}%`, height: '100%',
            background: power < 50 ? '#F7941D' : power < 80 ? '#ff6b00' : '#ff0000',
            transition: 'width 0.05s linear',
            borderRadius: 6,
          }} />
        </div>
      </div>
      <p className="text-center text-xs mb-4" style={{ color: '#a09080' }}>
        {spinning ? '\u00A0' : holding ? `${Math.round(power)}% — release to spin!` : 'Hold to power up — release to spin'}
      </p>
    </div>
  )
}
