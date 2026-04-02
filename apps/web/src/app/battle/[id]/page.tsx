'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const PLATFORM_ICONS: Record<string, string> = {
  google: '🔵', apple: '🍎', facebook: '📘', instagram: '📸',
  tiktok: '🎵', twitter: '🐦', snapchat: '👻', discord: '💬',
  spotify: '🎧', github: '🐱', linkedin: '💼', email: '✉️',
}

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
  const [challenger, setChallenger] = useState<{
    name: string; avatarUrl: string | null; provider: string | null; tagline: string | null
  } | null>(null)
  const [myMoves, setMyMoves] = useState<(Move | null)[]>([null, null, null])
  const [cpuMoves, setCpuMoves] = useState<Move[]>([])
  const [revealIdx, setRevealIdx] = useState(-1)
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null)

  const filledCount = myMoves.filter(Boolean).length

  const startGame = () => {
    setMyMoves([null, null, null])
    setCpuMoves([])
    setRevealIdx(-1)
    setResult(null)
    setPhase('picking')
  }

  const pickMove = (move: Move) => {
    const nextSlot = myMoves.findIndex((m) => m === null)
    if (nextSlot === -1) return
    const updated = [...myMoves]
    updated[nextSlot] = move
    setMyMoves(updated)
  }

  const undoSlot = (idx: number) => {
    if (!myMoves[idx]) return
    const updated = [...myMoves]
    updated[idx] = null
    setMyMoves(updated)
  }

  const submitMoves = () => {
    const moves = myMoves.filter(Boolean) as Move[]
    if (moves.length !== 3) return

    const cpu: Move[] = Array.from({ length: 3 }, () =>
      (['rock', 'paper', 'scissors'] as Move[])[Math.floor(Math.random() * 3)]
    )
    setCpuMoves(cpu)
    setPhase('reveal')

    let idx = 0
    const timer = setInterval(() => {
      setRevealIdx(idx)
      idx++
      if (idx >= 3) {
        clearInterval(timer)
        setTimeout(() => {
          let wins = 0, losses = 0
          for (let i = 0; i < 3; i++) {
            const r = resolveRound(moves[i], cpu[i])
            if (r === 'win') wins++
            else if (r === 'lose') losses++
          }
          setResult(wins > losses ? 'win' : losses > wins ? 'lose' : 'draw')
          setPhase('done')
        }, 800)
      }
    }, 1000)
  }

  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
      {phase === 'intro' && (
        <div className="text-center max-w-md">
          {/* Challenger identity */}
          {challenger?.avatarUrl ? (
            <div className="relative inline-block mb-4">
              <img src={challenger.avatarUrl} alt="" className="w-20 h-20 rounded-2xl object-cover mx-auto" />
              {challenger.provider && (
                <span className="absolute -bottom-1 -right-1 text-sm bg-night rounded-full w-7 h-7 flex items-center justify-center border border-white/10">
                  {PLATFORM_ICONS[challenger.provider] ?? '✉️'}
                </span>
              )}
            </div>
          ) : (
            <div className="text-6xl mb-4">✊✋✌️</div>
          )}
          <h1 className="text-3xl font-black text-surface mb-1">
            {challenger ? `${challenger.name} dropped a challenge` : "You've been challenged!"}
          </h1>
          {challenger?.tagline && (
            <p className="text-btc text-sm font-bold mb-2">"{challenger.tagline}"</p>
          )}
          <p className="text-surface/50 text-lg mb-2">Rock Paper Scissors</p>
          <p className="text-surface/30 text-sm mb-10">Winner loots the loser's deals</p>
          <button onClick={startGame} className="bg-btc text-night font-bold text-xl px-10 py-4 rounded-full hover:bg-btc-dark transition">
            Play Now
          </button>
        </div>
      )}

      {phase === 'picking' && (
        <div className="text-center">
          <h2 className="text-xl font-bold text-surface mb-2">Choose 3 moves</h2>
          <p className="text-surface/40 text-sm mb-2">{filledCount}/3 chosen</p>

          {/* Slots */}
          <div className="flex justify-center gap-4 mb-8">
            {myMoves.map((m, i) => (
              <button
                key={i}
                onClick={() => undoSlot(i)}
                className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl transition"
                style={{
                  background: m ? '#1a1230' : 'transparent',
                  border: m ? '2px solid #F7941D' : '2px dashed rgba(255,248,242,0.15)',
                  cursor: m ? 'pointer' : 'default',
                }}
              >
                {m ? MOVES.find((mv) => mv.key === m)?.icon : <span className="text-surface/15 text-sm">{i + 1}</span>}
              </button>
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-5 justify-center mb-6">
            {MOVES.map((move) => (
              <button
                key={move.key}
                onClick={() => pickMove(move.key)}
                disabled={filledCount >= 3}
                className="w-24 h-28 rounded-2xl flex flex-col items-center justify-center gap-1 transition hover:bg-white/10 disabled:opacity-30"
                style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.15)' }}
              >
                <span className="text-4xl">{move.icon}</span>
                <span className="text-surface/50 text-xs font-bold">{move.label}</span>
              </button>
            ))}
          </div>

          {filledCount === 3 && (
            <button onClick={submitMoves} className="bg-btc text-night font-bold text-lg px-10 py-4 rounded-full hover:bg-btc-dark transition">
              Ready!
            </button>
          )}
        </div>
      )}

      {(phase === 'reveal' || phase === 'done') && (
        <div className="text-center">
          <h2 className="text-xl font-bold text-surface mb-6">
            {phase === 'reveal' ? 'Revealing...' : result === 'win' ? '🎉 Victory!' : result === 'lose' ? '💀 Defeated' : '🤝 Draw'}
          </h2>

          <div className="space-y-4 mb-8">
            {[0, 1, 2].map((i) => {
              const shown = i <= revealIdx
              const myMove = myMoves[i] as Move
              const ri = shown ? (() => {
                if (myMove === cpuMoves[i]) return { color: '#888', text: '—' }
                return BEATS[myMove] === cpuMoves[i] ? { color: '#1D9E75', text: 'W' } : { color: '#E53E3E', text: 'L' }
              })() : null
              return (
                <div key={i} className="flex items-center justify-center gap-6" style={{ opacity: shown ? 1 : 0.2 }}>
                  <span className="text-3xl w-12 text-right" style={{ transform: 'rotate(90deg)' }}>{MOVES.find((m) => m.key === myMove)?.icon}</span>
                  <span className="text-surface/30 text-sm">vs</span>
                  <span className="text-3xl w-12" style={{ transform: 'rotate(-90deg)' }}>{shown ? MOVES.find((m) => m.key === cpuMoves[i])?.icon : '❓'}</span>
                  <span className="text-sm font-bold w-10" style={{ color: ri?.color ?? '#888' }}>{ri?.text ?? ''}</span>
                </div>
              )
            })}
          </div>

          {phase === 'done' && (
            <div>
              <p className="text-4xl font-black mb-6" style={{ color: result === 'win' ? '#1D9E75' : result === 'lose' ? '#E53E3E' : '#F7941D' }}>
                {result === 'win' ? '🎉 Victory!' : result === 'lose' ? '💀 Defeated' : '🤝 Draw'}
              </p>
              <button onClick={startGame} className="bg-btc text-night font-bold px-6 py-3 rounded-full hover:bg-btc-dark transition mb-8">
                Play Again
              </button>
              <div className="rounded-2xl p-6 text-center max-w-sm mx-auto" style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.1)' }}>
                <p className="text-surface font-bold mb-1">Want to keep playing?</p>
                <p className="text-surface/40 text-sm mb-4">Download the app to battle for real prizes</p>
                <div className="flex gap-3 justify-center">
                  <Link href="/coming-soon-app" className="border border-surface/20 text-surface/50 text-xs px-4 py-2 rounded-full hover:text-surface/70 transition">iOS</Link>
                  <Link href="/coming-soon-app" className="border border-surface/20 text-surface/50 text-xs px-4 py-2 rounded-full hover:text-surface/70 transition">Android</Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
