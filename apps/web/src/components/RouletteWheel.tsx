'use client'

import { useState, useRef } from 'react'

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

const SIZE = 340
const VB = 400
const CX = 200
const CY = 200
const R = 170
const INNER_R = 32
const POCKET_R = R * 0.6   // ball sits this far from center (inside segment)
const ORBIT_TX = 120
const BALL_SZ = 12

export function RouletteWheel({
  prizes = DEFAULT_PRIZES,
  onSpinComplete,
}: {
  prizes?: WheelPrize[]
  onSpinComplete?: (prize: WheelPrize, index: number) => void
}) {
  const [wheelDeg, setWheelDeg] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [ballState, setBallState] = useState<'idle' | 'spinning' | 'settling'>('idle')
  const [power, setPower] = useState(0)
  const [holding, setHolding] = useState(false)
  const [hasSpun, setHasSpun] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const N = prizes.length
  const DEG = 360 / N

  // ─── Segment SVG path (segment 0 starts at TOP via -90° offset) ────
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
        return prev + 2 // fills in ~2.5s
      })
    }, 50)
  }

  function endHold() {
    if (!holding) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    setHolding(false)

    const currentPower = power // capture before resetting
    setPower(0)

    if (spinning) return
    setSpinning(true)
    setHasSpun(true)
    setBallState('spinning')

    // Pick winner (weighted random)
    const total = prizes.reduce((s, p) => s + p.weight, 0)
    let rand = Math.random() * total
    let winIdx = 0
    for (let i = 0; i < N; i++) {
      rand -= prizes[i].weight
      if (rand <= 0) { winIdx = i; break }
    }

    // Rotate wheel so winning segment lands at BOTTOM (6 o'clock)
    // Segment i center from top = i * DEG + DEG/2
    // To bring to bottom: subtract 180°
    const segCenter = winIdx * DEG + DEG / 2
    const targetAngle = segCenter - 180
    const spinTo = -targetAngle + 5 * 360

    // Account for accumulated rotation
    const currentMod = ((wheelDeg % 360) + 360) % 360
    const targetMod = ((spinTo % 360) + 360) % 360
    let delta = 5 * 360 + targetMod - currentMod
    if (delta < 5 * 360) delta += 360

    setWheelDeg(prev => prev + delta)

    // Spin duration based on power: 3-8 seconds
    const spinDuration = 3000 + (currentPower / 100) * 5000

    // After CSS transition: settle ball to bottom
    setTimeout(() => {
      setBallState('settling')
      setSpinning(false)

      // After ball slides into position (0.5s)
      setTimeout(() => {
        setBallState('idle')
        console.log('Winner:', winIdx, prizes[winIdx].label)
        onSpinComplete?.(prizes[winIdx], winIdx)
      }, 600)
    }, spinDuration)
  }

  // ─── Ball positions (pixel space) ──────────────────────────────────
  const scale = SIZE / VB
  // Ball settled at BOTTOM: x = center, y = center + pocketRadius
  const ballSettledX = CX * scale - BALL_SZ / 2
  const ballSettledY = (CY + POCKET_R) * scale - BALL_SZ / 2

  // Spin duration for CSS (use a fixed 5s for the CSS transition,
  // the setTimeout handles actual timing)
  const cssDuration = spinning ? '5s' : '0s'

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
        {/* Ball */}
        {ballState === 'spinning' ? (
          <div
            className="absolute z-10 pointer-events-none"
            style={{ left: SIZE / 2 - BALL_SZ / 2, top: SIZE / 2 - BALL_SZ / 2, width: BALL_SZ, height: BALL_SZ }}
          >
            <div
              className="animate-[ballOrbit_0.4s_linear_infinite]"
              style={{
                width: BALL_SZ, height: BALL_SZ, borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 28%, #fff, #d4d4d4 45%, #999)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
              }}
            />
          </div>
        ) : (
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              width: BALL_SZ, height: BALL_SZ, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 28%, #fff, #d4d4d4 45%, #999)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
              left: ballSettledX, top: ballSettledY,
              transition: ballState === 'settling' ? 'left 0.5s ease, top 0.5s ease' : 'none',
            }}
          />
        )}

        {/* Wheel SVG */}
        <svg
          viewBox={`0 0 ${VB} ${VB}`}
          width={SIZE}
          height={SIZE}
          style={{
            transform: `rotate(${wheelDeg}deg)`,
            transition: spinning ? `transform ${cssDuration} cubic-bezier(0.17, 0.67, 0.12, 0.99)` : 'none',
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
        {spinning ? '\u00A0' : holding ? `${Math.round(power)}% — release to spin!` : hasSpun ? 'Hold to power up — release to spin' : 'Hold to power up — release to spin'}
      </p>

      <style>{`
        @keyframes ballOrbit {
          from { transform: rotate(0deg) translateX(${ORBIT_TX}px) rotate(0deg); }
          to { transform: rotate(-360deg) translateX(${ORBIT_TX}px) rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
