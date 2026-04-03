'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/* ─── 8-bit Audio ─── */
function beep(freq: number, dur: number) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur)
  } catch {}
}

function playWinFanfare() {
  // Drum roll
  for (let i = 0; i < 8; i++) {
    setTimeout(() => beep(i % 2 === 0 ? 200 : 220, 0.05), i * 60)
  }
  // Ascending C-E-G-C fanfare
  setTimeout(() => beep(523, 0.15), 500)
  setTimeout(() => beep(659, 0.15), 650)
  setTimeout(() => beep(784, 0.15), 800)
  setTimeout(() => beep(1047, 0.4), 950)
}

function playTryAgainSound() {
  // Descending wah-wah
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.setValueAtTime(400, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.8)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.9)
  } catch {}
}

/* ─── Fireworks Canvas ─── */
interface Particle {
  x: number; y: number; vx: number; vy: number
  color: string; size: number; life: number; shape: 'circle' | 'star'
}

const COLORS = ['#FFD700', '#FF1493', '#00CED1', '#32CD32', '#FF4500', '#9400D3']

function Fireworks({ active, cx, cy }: { active: boolean; cx: number; cy: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const rafRef = useRef(0)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Spawn 60 particles from center
    particles.current = Array.from({ length: 60 }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 3 + Math.random() * 8
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 2 + Math.random() * 4,
        life: 1,
        shape: Math.random() > 0.5 ? 'circle' : 'star',
      }
    })

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      let alive = false
      for (const p of particles.current) {
        if (p.life <= 0) continue
        alive = true
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.15 // gravity
        p.life -= 0.012
        p.vx *= 0.99

        ctx.globalAlpha = Math.max(p.life, 0)
        ctx.fillStyle = p.color
        if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.life * 10)
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
          ctx.restore()
        }
      }

      if (alive) rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, cx, cy])

  if (!active) return null
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[60]" />
}

/* ─── Confetti Rain ─── */
function ConfettiRain({ active }: { active: boolean }) {
  if (!active) return null
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 2,
    dur: 2 + Math.random() * 2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 4 + Math.random() * 4,
  }))
  return (
    <div className="fixed inset-0 pointer-events-none z-[55] overflow-hidden">
      {pieces.map((p) => (
        <div key={p.id} className="absolute animate-[confettiDrop_linear_infinite]"
          style={{
            left: `${p.x}%`, top: '-20px',
            width: p.size, height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      <style>{`@keyframes confettiDrop { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }`}</style>
    </div>
  )
}

/* ─── Main WinCelebration Component ─── */
export function WinCelebration({
  prize,
  prizeColor,
  businessName,
  isGuest = true,
  isTryAgain = false,
  onDismiss,
  onAddToWallet,
  onUseNow,
  muted = false,
}: {
  prize: string
  prizeColor?: string
  businessName?: string
  isGuest?: boolean
  isTryAgain?: boolean
  onDismiss: () => void
  onAddToWallet?: () => void
  onUseNow?: () => void
  muted?: boolean
}) {
  const [phase, setPhase] = useState(0)
  const [showFireworks, setShowFireworks] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [screenFlash, setScreenFlash] = useState(false)

  useEffect(() => {
    if (isTryAgain) {
      if (!muted) playTryAgainSound()
      // Shake handled by parent, auto dismiss
      const t = setTimeout(onDismiss, 2000)
      return () => clearTimeout(t)
    }

    // Win sequence
    if (!muted) playWinFanfare()

    // Phase 1: overlay (0ms)
    setPhase(1)

    // Phase 2: fireworks (200ms)
    setTimeout(() => { setShowFireworks(true); setPhase(2) }, 200)

    // Phase 3: text slam (500ms) + screen flash
    setTimeout(() => { setPhase(3); setScreenFlash(true) }, 500)
    setTimeout(() => setScreenFlash(false), 650)

    // Phase 4: prize card (1200ms) + confetti
    setTimeout(() => { setPhase(4); setShowConfetti(true) }, 1200)

    // Phase 5: buttons (1500ms)
    setTimeout(() => setPhase(5), 1500)

    // Stop fireworks
    setTimeout(() => setShowFireworks(false), 2500)
  }, [isTryAgain, muted, onDismiss])

  if (isTryAgain) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center animate-[shake_0.3s_ease_2]">
        <div className="rounded-2xl p-6 text-center" style={{ background: '#1a1230', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="text-3xl mb-2">😤</p>
          <p className="text-white font-black text-xl">Try Again!</p>
        </div>
        <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-10px)} 75%{transform:translateX(10px)} }`}</style>
      </div>
    )
  }

  return (
    <>
      {/* Screen flash */}
      {screenFlash && <div className="fixed inset-0 z-[70] bg-white/30 pointer-events-none" />}

      {/* Fireworks canvas */}
      <Fireworks active={showFireworks} cx={window?.innerWidth / 2 ?? 200} cy={window?.innerHeight / 2 ?? 300} />

      {/* Confetti rain */}
      <ConfettiRain active={showConfetti} />

      {/* Overlay */}
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 bg-black/70" onClick={onDismiss}>
        <div onClick={(e) => e.stopPropagation()} className="max-w-sm w-full text-center">
          {/* Phase 3: "YOU WON!" slam text */}
          {phase >= 3 && (
            <p
              className="font-black mb-4 animate-[slamDown_0.4s_cubic-bezier(0.34,1.56,0.64,1)]"
              style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', color: '#FFD700', fontFamily: "'Press Start 2P', monospace" }}
            >
              YOU WON!
            </p>
          )}

          {/* Phase 4: Prize card */}
          {phase >= 4 && (
            <div
              className="rounded-2xl p-6 mb-4 animate-[slideUp_0.4s_ease-out]"
              style={{ background: '#fff', borderTop: `4px solid ${prizeColor || '#F7941D'}` }}
            >
              <p className="text-4xl mb-2">🎉</p>
              <p className="text-2xl font-black" style={{ color: prizeColor || '#F7941D' }}>{prize}</p>
              {businessName && <p className="text-gray-500 text-sm mt-1">{businessName}</p>}
            </div>
          )}

          {/* Phase 5: Buttons */}
          {phase >= 5 && (
            <div className="space-y-3 animate-[fadeIn_0.3s_ease]">
              {isGuest ? (
                <Link href="/sign-up" className="block w-full bg-[#F7941D] text-[#0f0a1e] font-bold py-3 rounded-xl text-center">
                  Sign Up to Claim 🎁
                </Link>
              ) : (
                <>
                  <button onClick={onAddToWallet} className="w-full bg-[#F7941D] text-[#0f0a1e] font-bold py-3 rounded-xl">
                    Add to Lootbox 🎁
                  </button>
                  <button onClick={onUseNow} className="w-full border-2 border-gray-300 text-gray-700 font-bold py-3 rounded-xl">
                    Use Now 📍
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  const sd = { title: 'SerendipEatery Win!', text: `I just won ${prize}${businessName ? ` at ${businessName}` : ''} on SerendipEatery! 🎰`, url: typeof window !== 'undefined' ? window.location.origin : '' }
                  if (navigator.share) navigator.share(sd).catch(() => {})
                }}
                className="text-gray-400 text-sm hover:text-gray-600"
              >
                Share Win 🎉
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slamDown { 0%{transform:translateY(-200px) scale(1.3);opacity:0} 60%{transform:translateY(10px) scale(1);opacity:1} 100%{transform:translateY(0) scale(1)} }
        @keyframes slideUp { 0%{transform:translateY(60px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @keyframes fadeIn { 0%{opacity:0} 100%{opacity:1} }
      `}</style>
    </>
  )
}
