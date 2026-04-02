'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Move = 'rock' | 'paper' | 'scissors'

const MOVES: { key: Move; icon: string; label: string }[] = [
  { key: 'rock', icon: '✊', label: 'Rock' },
  { key: 'paper', icon: '✋', label: 'Paper' },
  { key: 'scissors', icon: '✌️', label: 'Scissors' },
]

const BEATS: Record<Move, Move> = { rock: 'scissors', scissors: 'paper', paper: 'rock' }

function resolveRound(a: Move, b: Move): 'win' | 'lose' | 'draw' {
  if (a === b) return 'draw'
  return BEATS[a] === b ? 'win' : 'lose'
}

type Phase = 'intro' | 'picking' | 'reveal' | 'done'

export default function BattlePage() {
  const { id } = useParams<{ id: string }>()
  const [phase, setPhase] = useState<Phase>('intro')
  const [myMoves, setMyMoves] = useState<Move[]>([])
  const [cpuMoves, setCpuMoves] = useState<Move[]>([])
  const [revealIdx, setRevealIdx] = useState(-1)
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null)

  const startGame = () => {
    setMyMoves([])
    setCpuMoves([])
    setRevealIdx(-1)
    setResult(null)
    setPhase('picking')
  }

  const pickMove = (move: Move) => {
    if (myMoves.length >= 3) return
    const updated = [...myMoves, move]
    setMyMoves(updated)

    if (updated.length === 3) {
      // Generate CPU moves
      const cpu: Move[] = Array.from({ length: 3 }, () =>
        (['rock', 'paper', 'scissors'] as Move[])[Math.floor(Math.random() * 3)]
      )
      setCpuMoves(cpu)

      // Reveal rounds one by one
      setPhase('reveal')
      let idx = 0
      const timer = setInterval(() => {
        setRevealIdx(idx)
        idx++
        if (idx >= 3) {
          clearInterval(timer)
          // Calculate result
          setTimeout(() => {
            let wins = 0
            let losses = 0
            for (let i = 0; i < 3; i++) {
              const r = resolveRound(updated[i], cpu[i])
              if (r === 'win') wins++
              else if (r === 'lose') losses++
            }
            setResult(wins > losses ? 'win' : losses > wins ? 'lose' : 'draw')
            setPhase('done')
          }, 800)
        }
      }, 1000)
    }
  }

  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
      {/* Intro */}
      {phase === 'intro' && (
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">✊✋✌️</div>
          <h1 className="text-3xl font-black text-surface mb-3">You've been challenged!</h1>
          <p className="text-surface/50 text-lg mb-2">Rock Paper Scissors</p>
          <p className="text-surface/30 text-sm mb-10">Winner loots the loser's deals</p>
          <button
            onClick={startGame}
            className="bg-btc text-night font-bold text-xl px-10 py-4 rounded-full hover:bg-btc-dark transition"
          >
            Play Now
          </button>
        </div>
      )}

      {/* Picking moves */}
      {phase === 'picking' && (
        <div className="text-center">
          <h2 className="text-xl font-bold text-surface mb-2">Choose 3 moves</h2>
          <p className="text-surface/40 text-sm mb-6">Best 2 of 3</p>

          {/* Move dots */}
          <div className="flex justify-center gap-4 mb-8">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                style={{
                  background: myMoves[i] ? '#1a1230' : 'transparent',
                  border: myMoves[i] ? '2px solid #F7941D' : '2px dashed rgba(255,248,242,0.2)',
                }}
              >
                {myMoves[i] ? MOVES.find((m) => m.key === myMoves[i])?.icon : ''}
              </div>
            ))}
          </div>

          {/* Move buttons */}
          <div className="flex gap-5 justify-center">
            {MOVES.map((move) => (
              <button
                key={move.key}
                onClick={() => pickMove(move.key)}
                disabled={myMoves.length >= 3}
                className="w-24 h-28 rounded-2xl flex flex-col items-center justify-center gap-1 transition hover:bg-white/10 disabled:opacity-30"
                style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.15)' }}
              >
                <span className="text-4xl">{move.icon}</span>
                <span className="text-surface/50 text-xs font-bold">{move.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reveal */}
      {(phase === 'reveal' || phase === 'done') && (
        <div className="text-center">
          <h2 className="text-xl font-bold text-surface mb-6">
            {phase === 'reveal' ? 'Revealing...' : result === 'win' ? 'You Win!' : result === 'lose' ? 'You Lose' : 'Draw!'}
          </h2>

          <div className="space-y-4 mb-8">
            {[0, 1, 2].map((i) => {
              const shown = i <= revealIdx
              const roundResult = shown ? resolveRound(myMoves[i], cpuMoves[i]) : null
              return (
                <div
                  key={i}
                  className="flex items-center justify-center gap-6 transition-all"
                  style={{ opacity: shown ? 1 : 0.2 }}
                >
                  <span className="text-3xl w-12 text-right">
                    {MOVES.find((m) => m.key === myMoves[i])?.icon}
                  </span>
                  <span className="text-surface/30 text-sm">vs</span>
                  <span className="text-3xl w-12">
                    {shown ? MOVES.find((m) => m.key === cpuMoves[i])?.icon : '❓'}
                  </span>
                  <span
                    className="text-sm font-bold w-10"
                    style={{
                      color: roundResult === 'win' ? '#1D9E75' : roundResult === 'lose' ? '#E53E3E' : '#888',
                    }}
                  >
                    {shown ? (roundResult === 'win' ? 'W' : roundResult === 'lose' ? 'L' : '—') : ''}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Result */}
          {phase === 'done' && (
            <div>
              <p
                className="text-4xl font-black mb-8"
                style={{ color: result === 'win' ? '#1D9E75' : result === 'lose' ? '#E53E3E' : '#F7941D' }}
              >
                {result === 'win' ? '🎉 Victory!' : result === 'lose' ? '💀 Defeated' : '🤝 Draw'}
              </p>

              <div className="flex gap-3 justify-center mb-10">
                <button
                  onClick={startGame}
                  className="bg-btc text-night font-bold px-6 py-3 rounded-full hover:bg-btc-dark transition"
                >
                  Play Again
                </button>
              </div>

              {/* App download CTA */}
              <div
                className="rounded-2xl p-6 text-center max-w-sm mx-auto"
                style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.1)' }}
              >
                <p className="text-surface font-bold mb-1">Want to keep playing?</p>
                <p className="text-surface/40 text-sm mb-4">Download the app to battle for real prizes</p>
                <div className="flex gap-3 justify-center">
                  <Link
                    href="/coming-soon-app"
                    className="border border-surface/20 text-surface/50 text-xs px-4 py-2 rounded-full hover:text-surface/70 transition"
                  >
                    iOS
                  </Link>
                  <Link
                    href="/coming-soon-app"
                    className="border border-surface/20 text-surface/50 text-xs px-4 py-2 rounded-full hover:text-surface/70 transition"
                  >
                    Android
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
