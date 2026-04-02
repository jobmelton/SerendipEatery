'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Move = 'rock' | 'paper' | 'scissors'
const MOVES: { key: Move; icon: string; label: string }[] = [
  { key: 'rock', icon: '✊', label: 'Rock' },
  { key: 'paper', icon: '✋', label: 'Paper' },
  { key: 'scissors', icon: '✌️', label: 'Scissors' },
]

type Phase = 'loading' | 'intro' | 'picking' | 'reveal' | 'done'

function getSessionId() {
  let sid = typeof window !== 'undefined' ? sessionStorage.getItem('battle_session') : null
  if (!sid) {
    sid = crypto.randomUUID()
    if (typeof window !== 'undefined') sessionStorage.setItem('battle_session', sid)
  }
  return sid
}

export default function BusinessBattlePage() {
  const { businessId } = useParams<{ businessId: string }>()
  const [phase, setPhase] = useState<Phase>('loading')
  const [bizName, setBizName] = useState('')
  const [myMoves, setMyMoves] = useState<Move[]>([])
  const [houseMoves, setHouseMoves] = useState<Move[]>([])
  const [revealIdx, setRevealIdx] = useState(-1)
  const [winner, setWinner] = useState<'player' | 'house' | 'draw' | null>(null)
  const [prizeCode, setPrizeCode] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/battles/business-station/${businessId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setBizName(d.data.businessName)
          setPhase('intro')
        } else {
          setBizName('this business')
          setPhase('intro')
        }
      })
      .catch(() => {
        setBizName('this business')
        setPhase('intro')
      })
  }, [businessId])

  const startGame = () => {
    setMyMoves([])
    setHouseMoves([])
    setRevealIdx(-1)
    setWinner(null)
    setPrizeCode(null)
    setPhase('picking')
  }

  const pickMove = (move: Move) => {
    if (myMoves.length >= 3) return
    const updated = [...myMoves, move]
    setMyMoves(updated)

    if (updated.length === 3) {
      setPhase('reveal')

      fetch(`${API_URL}/battles/business-station/${businessId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves: updated, sessionId: getSessionId() }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            setHouseMoves(d.data.houseMoves)
            setPrizeCode(d.data.prizeCode)

            // Reveal rounds
            let idx = 0
            const timer = setInterval(() => {
              setRevealIdx(idx)
              idx++
              if (idx >= 3) {
                clearInterval(timer)
                setTimeout(() => {
                  setWinner(d.data.winner)
                  setPhase('done')
                }, 800)
              }
            }, 1000)
          }
        })
        .catch(() => {
          // Fallback: resolve locally
          const cpu: Move[] = [0, 1, 2].map(() =>
            (['rock', 'paper', 'scissors'] as Move[])[Math.floor(Math.random() * 3)]
          )
          setHouseMoves(cpu)
          let idx = 0
          const timer = setInterval(() => {
            setRevealIdx(idx)
            idx++
            if (idx >= 3) {
              clearInterval(timer)
              setTimeout(() => {
                setWinner('draw')
                setPhase('done')
              }, 800)
            }
          }, 1000)
        })
    }
  }

  const resolveIcon = (a: Move, b: Move): { color: string; text: string } => {
    if (a === b) return { color: '#888', text: '—' }
    const beats: Record<string, string> = { rock: 'scissors', scissors: 'paper', paper: 'rock' }
    return beats[a] === b ? { color: '#1D9E75', text: 'W' } : { color: '#E53E3E', text: 'L' }
  }

  const initial = bizName ? bizName[0].toUpperCase() : '?'

  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
      {phase === 'loading' && (
        <p className="text-surface/50 animate-pulse">Loading...</p>
      )}

      {phase === 'intro' && (
        <div className="text-center max-w-md">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-4xl font-black text-night"
            style={{ background: '#F7941D' }}
          >
            {initial}
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-surface mb-2">
            Can you beat {bizName}?
          </h1>
          <p className="text-surface/50 text-lg mb-2">Rock Paper Scissors</p>
          <p className="text-surface/30 text-sm mb-10">Win and spin for a free prize</p>
          <button
            onClick={startGame}
            className="bg-btc text-night font-bold text-xl px-10 py-4 rounded-full hover:bg-btc-dark transition"
          >
            Play Now
          </button>
        </div>
      )}

      {phase === 'picking' && (
        <div className="text-center">
          <h2 className="text-xl font-bold text-surface mb-2">Choose 3 moves</h2>
          <p className="text-surface/40 text-sm mb-6">Best 2 of 3 vs {bizName}</p>

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

      {(phase === 'reveal' || phase === 'done') && (
        <div className="text-center">
          <h2 className="text-xl font-bold text-surface mb-6">
            {phase === 'reveal' ? `Playing vs ${bizName}...` : winner === 'player' ? 'You Win!' : winner === 'house' ? 'Nice try!' : 'Draw!'}
          </h2>

          <div className="space-y-4 mb-8">
            {[0, 1, 2].map((i) => {
              const shown = i <= revealIdx && houseMoves[i]
              const ri = shown ? resolveIcon(myMoves[i], houseMoves[i]) : null
              return (
                <div key={i} className="flex items-center justify-center gap-6" style={{ opacity: shown ? 1 : 0.2 }}>
                  <span className="text-3xl w-12 text-right">
                    {MOVES.find((m) => m.key === myMoves[i])?.icon}
                  </span>
                  <span className="text-surface/30 text-sm">vs</span>
                  <span className="text-3xl w-12">
                    {shown ? MOVES.find((m) => m.key === houseMoves[i])?.icon : '❓'}
                  </span>
                  <span className="text-sm font-bold w-10" style={{ color: ri?.color ?? '#888' }}>
                    {ri?.text ?? ''}
                  </span>
                </div>
              )
            })}
          </div>

          {phase === 'done' && (
            <div>
              {winner === 'player' && prizeCode ? (
                <div
                  className="rounded-2xl p-6 mb-8 max-w-sm mx-auto"
                  style={{ background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.3)' }}
                >
                  <p className="text-teal font-bold text-lg mb-2">You won a prize!</p>
                  <p className="text-surface/50 text-sm mb-3">Show this code at the counter:</p>
                  <p className="text-btc font-mono text-2xl font-bold tracking-widest">{prizeCode}</p>
                </div>
              ) : winner === 'house' ? (
                <div className="mb-8">
                  <p className="text-surface/50 text-lg mb-2">Come back and challenge us again!</p>
                </div>
              ) : (
                <div className="mb-8">
                  <p className="text-surface/50 text-lg mb-2">So close! Try again?</p>
                </div>
              )}

              <div className="flex gap-3 justify-center mb-10">
                <button
                  onClick={startGame}
                  className="bg-btc text-night font-bold px-6 py-3 rounded-full hover:bg-btc-dark transition"
                >
                  Play Again
                </button>
              </div>

              <div
                className="rounded-2xl p-6 text-center max-w-sm mx-auto"
                style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.1)' }}
              >
                <p className="text-surface font-bold mb-1">Save your wins in the app</p>
                <p className="text-surface/40 text-sm mb-4">Battle friends, collect prizes, level up</p>
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
