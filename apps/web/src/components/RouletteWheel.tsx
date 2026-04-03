'use client'

import { useState, useCallback } from 'react'

/**
 * RouletteWheel — minimal verified implementation.
 *
 * Segment 0 starts at TOP (12 o'clock) due to -90° offset in radians.
 * Winning segment rotates to TOP via CSS transform.
 * Ball has 2 states: spinning (CSS orbit) or settled (fixed at top).
 * prizes[winnerIndex] is ALWAYS the displayed prize.
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

const SIZE = 340         // rendered px
const VB = 400           // viewBox
const CX = 200
const CY = 200
const R = 170
const INNER_R = 32
const POCKET_Y = CY - R * 0.6  // where ball sits inside segment at top
const ORBIT_TX = 120     // ball orbit translateX radius (in ball-container coords)
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

  const N = prizes.length
  const DEG = 360 / N

  // ─── Draw each segment ─────────────────────────────────────────────
  function segPath(i: number) {
    const startDeg = i * DEG
    const endDeg = (i + 1) * DEG
    // -90 offset so segment 0 starts at TOP (12 o'clock)
    const startRad = (startDeg - 90) * Math.PI / 180
    const endRad = (endDeg - 90) * Math.PI / 180
    const x1 = CX + R * Math.cos(startRad)
    const y1 = CY + R * Math.sin(startRad)
    const x2 = CX + R * Math.cos(endRad)
    const y2 = CY + R * Math.sin(endRad)
    const large = DEG > 180 ? 1 : 0
    return `M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} Z`
  }

  function labelPos(i: number) {
    const midDeg = i * DEG + DEG / 2
    const midRad = (midDeg - 90) * Math.PI / 180
    const lr = R * 0.58
    return { x: CX + lr * Math.cos(midRad), y: CY + lr * Math.sin(midRad), deg: midDeg }
  }

  // ─── Hold to charge ────────────────────────────────────────────────
  const startHold = useCallback(() => {
    if (spinning) return
    setHolding(true)
    setPower(0)
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const p = Math.min(elapsed / 3000 * 100, 100)
      setPower(p)
      if (p < 100 && holding) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [spinning, holding])

  // ─── Release to spin ───────────────────────────────────────────────
  const releaseHold = useCallback(() => {
    if (!holding || spinning) return
    setHolding(false)
    setPower(0)
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

    // Rotate wheel so winning segment lands at TOP
    // Segment i center = i * DEG + DEG/2 degrees from start
    // To bring to top (0°): rotate by -(that angle)
    // Add 5 full spins
    const segCenter = winIdx * DEG + DEG / 2
    const spinTo = -segCenter + 5 * 360

    setWheelDeg(prev => prev + spinTo)

    // After CSS transition ends (5s): settle ball to top
    setTimeout(() => {
      setBallState('settling')
      setSpinning(false)

      // After ball settles (0.5s transition)
      setTimeout(() => {
        setBallState('idle')
        console.log('Winner:', winIdx, prizes[winIdx].label)
        onSpinComplete?.(prizes[winIdx], winIdx)
      }, 600)
    }, 5000)
  }, [holding, spinning, prizes, N, DEG, onSpinComplete])

  // ─── Ball position ─────────────────────────────────────────────────
  // Scale from viewBox to display px
  const scale = SIZE / VB
  const ballTopX = CX * scale - BALL_SZ / 2
  const ballTopY = POCKET_Y * scale - BALL_SZ / 2

  return (
    <div className="relative">
      <div
        className="relative cursor-pointer select-none mx-auto"
        style={{ width: SIZE, height: SIZE }}
        onMouseDown={startHold}
        onMouseUp={releaseHold}
        onMouseLeave={() => { if (holding) releaseHold() }}
        onTouchStart={startHold}
        onTouchEnd={releaseHold}
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
              left: ballTopX, top: ballTopY,
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
            transition: spinning ? 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
          }}
        >
          {/* Outer gold ring */}
          <circle cx={CX} cy={CY} r={R + 10} fill="none" stroke="#FFD700" strokeWidth="3" />

          {/* Bumps */}
          {prizes.map((_, i) => {
            const a = (i * DEG - 90) * Math.PI / 180
            return <circle key={`b${i}`} cx={CX + (R + 6) * Math.cos(a)} cy={CY + (R + 6) * Math.sin(a)} r="3.5" fill="#FFD700" />
          })}

          {/* Segments */}
          {prizes.map((p, i) => {
            const lp = labelPos(i)
            const dark = p.color === '#2a2a2a' || p.color === '#9400D3' || p.color === '#4169E1'
            return (
              <g key={`s${i}`}>
                <path d={segPath(i)} fill={p.color} stroke="#FFD700" strokeWidth="1" />
                <text
                  x={lp.x} y={lp.y}
                  fill={dark ? '#fff' : '#1a0e00'}
                  fontSize={DEG < 25 ? '8' : '11'}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${lp.deg},${lp.x},${lp.y})`}
                >
                  {p.label.length > 10 ? p.label.slice(0, 9) + '…' : p.label}
                </text>
              </g>
            )
          })}

          {/* Center hub */}
          <circle cx={CX} cy={CY} r={INNER_R + 2} fill="#1a0e00" stroke="#FFD700" strokeWidth="2.5" />
          <text x={CX} y={CY} fill="#FFD700" fontSize="26" fontWeight="900" textAnchor="middle" dominantBaseline="central" fontFamily="Arial Black,sans-serif">S</text>
        </svg>
      </div>

      {/* Power meter */}
      <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden mx-auto mt-2 mb-1">
        <div className="h-full rounded-full" style={{ width: `${power}%`, background: power > 70 ? '#1D9E75' : '#F7941D', transition: holding ? 'none' : 'width 0.3s' }} />
      </div>
      <p className="text-center text-xs mb-4" style={{ color: 'rgba(255,248,242,0.3)' }}>
        {spinning ? '\u00A0' : holding ? 'Release to spin!' : hasSpun ? 'Hold to spin again' : 'Hold and release to spin'}
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
