'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Move = 'rock' | 'paper' | 'scissors'
const MOVES: { key: Move; icon: string; label: string }[] = [
  { key: 'rock', icon: '✊', label: 'Rock' },
  { key: 'paper', icon: '✋', label: 'Paper' },
  { key: 'scissors', icon: '✌️', label: 'Scissors' },
]
const BEATS: Record<Move, Move> = { rock: 'scissors', scissors: 'paper', paper: 'rock' }

type Phase = 'intro' | 'picking' | 'waiting' | 'countdown' | 'reveal' | 'roundResult' | 'done'

const MOVE_TO_EMOJI: Record<Move, string> = { rock: '✊', paper: '✋', scissors: '✌️' }

function resolveIcon(a: Move, b: Move) {
  if (a === b) return { color: '#888', text: '—' }
  return BEATS[a] === b ? { color: '#1D9E75', text: 'W' } : { color: '#E53E3E', text: 'L' }
}

export default function DemoBattlePage() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [myMoves, setMyMoves] = useState<(Move | null)[]>([null, null, null])
  const [houseMoves, setHouseMoves] = useState<Move[]>([])
  const [revealIdx, setRevealIdx] = useState(-1)
  const [countdownNum, setCountdownNum] = useState(0)
  const [roundText, setRoundText] = useState<{ text: string; color: string } | null>(null)
  const [winner, setWinner] = useState<string | null>(null)
  const [showDropped, setShowDropped] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)

  const isMidGame = phase === 'waiting' || phase === 'countdown' || phase === 'reveal' || phase === 'roundResult'

  const handleExit = () => {
    if (isMidGame) { setShowLeaveModal(true); return }
    window.location.href = '/'
  }

  const filledCount = myMoves.filter(Boolean).length

  // Show "challenge dropped" notification if opened from shared link
  useEffect(() => {
    if (typeof window !== 'undefined' && document.referrer) {
      setShowDropped(true)
      setTimeout(() => setShowDropped(false), 4000)
    }
  }, [])

  const startGame = () => {
    setMyMoves([null, null, null])
    setHouseMoves([])
    setRevealIdx(-1)
    setWinner(null)
    setPhase('picking')
  }

  const pickMove = (move: Move) => {
    const nextSlot = myMoves.findIndex((m) => m === null)
    if (nextSlot === -1) return
    const updated = [...myMoves]
    updated[nextSlot] = move
    setMyMoves(updated as (Move | null)[])
  }

  const undoSlot = (idx: number) => {
    if (!myMoves[idx]) return
    const updated = [...myMoves]
    updated[idx] = null
    setMyMoves(updated)
  }

  const submitMoves = async () => {
    const moves = myMoves.filter(Boolean) as Move[]
    if (moves.length !== 3) return
    setPhase('waiting')

    try {
      const res = await fetch(`${API_URL}/battles/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves }),
      })
      const data = await res.json()

      setTimeout(() => {
        if (data.ok) {
          setHouseMoves(data.data.houseMoves)
          runCountdownAndReveal(moves, data.data.houseMoves, data.data.winner)
        }
      }, 1000)
    } catch {
      const cpu: Move[] = ['rock', 'paper', 'scissors'].sort(() => Math.random() - 0.5).slice(0, 3) as Move[]
      setTimeout(() => {
        setHouseMoves(cpu)
        runCountdownAndReveal(moves, cpu, 'draw')
      }, 1000)
    }
  }

  // Fist-pump countdown → reveal → round result overlay
  const runCountdownAndReveal = (playerMoves: Move[], opponentMoves: Move[], finalWinner: string) => {
    let roundIdx = 0

    const playRound = () => {
      if (roundIdx >= 3) {
        setWinner(finalWinner)
        setPhase('done')
        return
      }

      // Countdown: 1, 2, 3
      setPhase('countdown')
      setCountdownNum(1)
      setTimeout(() => setCountdownNum(2), 500)
      setTimeout(() => setCountdownNum(3), 1000)

      // Reveal moves
      setTimeout(() => {
        setRevealIdx(roundIdx)
        setPhase('reveal')
      }, 1500)

      // Show round result overlay
      setTimeout(() => {
        const my = playerMoves[roundIdx]
        const opp = opponentMoves[roundIdx]
        const rr = my === opp ? 'draw' : BEATS[my] === opp ? 'win' : 'lose'
        setRoundText(
          rr === 'win' ? { text: 'YOU WIN THIS ROUND', color: '#1D9E75' }
            : rr === 'lose' ? { text: 'YOU LOSE THIS ROUND', color: '#E53E3E' }
            : { text: 'DRAW', color: '#F7941D' }
        )
        setPhase('roundResult')
      }, 2500)

      // Fade out + next round
      setTimeout(() => {
        setRoundText(null)
        roundIdx++
        playRound()
      }, 4000)
    }

    playRound()
  }

  const dropChallenge = async () => {
    const url = `${window.location.origin}/battle/demo`
    const shareData = {
      title: 'SerendipEatery RPS Challenge',
      text: "I just dropped a Rock Paper Scissors challenge at SerendipEatery. Winner takes deals. You in? 👊",
      url,
    }
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {})
    } else {
      setShowShareModal(true)
    }
  }

  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6 relative">
      {/* Exit button */}
      <button onClick={handleExit} className="fixed top-4 left-4 z-40" style={{ color: '#a09080', fontSize: '0.9rem' }}>
        ← Home
      </button>

      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowLeaveModal(false)} />
          <div className="relative rounded-2xl p-6 max-w-xs w-full text-center" style={{ background: '#1a1230' }}>
            <p className="text-surface font-bold mb-4">Leave battle?</p>
            <div className="flex gap-3">
              <button onClick={() => { window.location.href = '/' }} className="flex-1 bg-red-500/20 text-red-400 font-bold py-2.5 rounded-xl text-sm">Yes, leave</button>
              <button onClick={() => setShowLeaveModal(false)} className="flex-1 bg-btc text-night font-bold py-2.5 rounded-xl text-sm">Stay</button>
            </div>
          </div>
        </div>
      )}

      {/* Dropped notification */}
      {showDropped && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-btc text-night px-6 py-3 rounded-full font-bold text-sm shadow-lg animate-bounce">
          Someone dropped a challenge nearby!
        </div>
      )}

      {/* Players display */}
      <div className="flex items-center gap-8 mb-8">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-surface/20 flex items-center justify-center text-2xl mb-1">👤</div>
          <p className="text-surface/50 text-xs">You</p>
        </div>
        <span className="text-btc text-2xl font-black">VS</span>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-btc flex items-center justify-center text-xl font-black text-night mb-1">S</div>
          <p className="text-surface/50 text-xs">The House</p>
        </div>
      </div>

      {/* Intro */}
      {phase === 'intro' && (
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-black text-surface mb-3">Rock Paper Scissors</h1>
          <p className="text-surface/50 mb-8">Best 2 of 3 — winner takes deals</p>
          <button onClick={startGame} className="bg-btc text-night font-bold text-xl px-10 py-4 rounded-full hover:bg-btc-dark transition">
            Play Now
          </button>
        </div>
      )}

      {/* Picking */}
      {phase === 'picking' && (
        <div className="text-center">
          <p className="text-surface/50 text-sm mb-2">{filledCount}/3 chosen</p>

          {/* 3 slots */}
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
                title={m ? 'Tap to undo' : ''}
              >
                {m ? MOVES.find((mv) => mv.key === m)?.icon : <span className="text-surface/15 text-sm">{i + 1}</span>}
              </button>
            ))}
          </div>

          {/* Move buttons */}
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

      {/* Waiting */}
      {phase === 'waiting' && (
        <div className="text-center">
          <div className="text-4xl animate-pulse mb-4">⏳</div>
          <p className="text-surface/50">The House is choosing...</p>
        </div>
      )}

      {/* Countdown — fist pump */}
      {phase === 'countdown' && (
        <div className="text-center">
          <div className="flex items-center justify-center gap-12 mb-6">
            <span className="text-6xl animate-bounce" style={{ animationDuration: '0.5s', transform: 'rotate(90deg)' }}>✊</span>
            <span className="text-6xl animate-bounce" style={{ animationDuration: '0.5s', transform: 'rotate(-90deg)' }}>✊</span>
          </div>
          <p className="text-7xl font-black text-btc animate-pulse">{countdownNum}</p>
        </div>
      )}

      {/* Round result overlay */}
      {phase === 'roundResult' && roundText && (
        <div className="text-center">
          <div className="flex items-center justify-center gap-8 mb-6">
            <span className="text-5xl" style={{ transform: 'rotate(90deg)' }}>{MOVE_TO_EMOJI[myMoves[revealIdx] as Move]}</span>
            <span className="text-surface/30 text-lg">vs</span>
            <span className="text-5xl" style={{ transform: 'rotate(-90deg)' }}>{MOVE_TO_EMOJI[houseMoves[revealIdx]]}</span>
          </div>
          <p className="text-3xl md:text-4xl font-black animate-pulse" style={{ color: roundText.color }}>
            {roundText.text}
          </p>
        </div>
      )}

      {/* Reveal scoreboard + Done */}
      {(phase === 'reveal' || phase === 'done') && !roundText && (
        <div className="text-center">
          {phase === 'reveal' && (
            <div className="flex items-center justify-center gap-8 mb-6">
              <span className="text-5xl" style={{ transform: 'rotate(90deg)' }}>{MOVE_TO_EMOJI[myMoves[revealIdx] as Move]}</span>
              <span className="text-surface/30 text-lg">vs</span>
              <span className="text-5xl" style={{ transform: 'rotate(-90deg)' }}>{MOVE_TO_EMOJI[houseMoves[revealIdx]]}</span>
            </div>
          )}

          {phase === 'done' && (
            <div className="text-center mb-4">
              <p className="text-4xl font-black" style={{
                color: winner === 'player' ? '#1D9E75' : winner === 'house' ? '#E53E3E' : '#F7941D',
              }}>
                {winner === 'player' ? 'YOU WIN! 🎉' : winner === 'house' ? 'YOU LOSE 😤' : 'DRAW 🤝'}
              </p>
              <p className="text-btc font-black text-lg animate-[floatUp_1.5s_ease-out_forwards]">
                +{winner === 'player' ? '25' : winner === 'house' ? '5' : '5'} pts
              </p>
              <style>{`@keyframes floatUp { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(-30px); } }`}</style>
            </div>
          )}

          {/* Score summary */}
          <div className="space-y-3 mb-8">
            {[0, 1, 2].map((i) => {
              const shown = i <= revealIdx && houseMoves[i]
              const myMove = myMoves[i] as Move
              const ri = shown ? resolveIcon(myMove, houseMoves[i]) : null
              return (
                <div key={i} className="flex items-center justify-center gap-6" style={{ opacity: shown ? 1 : 0.2 }}>
                  <span className="text-2xl w-10 text-right" style={{ transform: 'rotate(90deg)' }}>{MOVES.find((m) => m.key === myMove)?.icon}</span>
                  <span className="text-surface/30 text-xs">vs</span>
                  <span className="text-2xl w-10" style={{ transform: 'rotate(-90deg)' }}>{shown ? MOVES.find((m) => m.key === houseMoves[i])?.icon : '❓'}</span>
                  <span className="text-sm font-bold w-8" style={{ color: ri?.color ?? '#888' }}>{ri?.text ?? ''}</span>
                </div>
              )
            })}
          </div>

          {phase === 'done' && (
            <div>
              <div className="flex flex-col gap-3 items-center mb-6 w-full max-w-xs mx-auto">
                <button onClick={startGame} className="w-full bg-btc text-night font-bold py-3 rounded-full hover:bg-btc-dark transition">Play Again</button>
                <button onClick={dropChallenge} className="w-full border border-btc text-btc font-bold py-3 rounded-full hover:bg-btc/10 transition">
                  ✌️ Drop a Challenge
                </button>
                <Link href="/" className="w-full text-center py-3 rounded-full text-sm" style={{ color: '#a09080' }}>
                  ← Home
                </Link>
              </div>

              <div className="rounded-2xl p-5 max-w-sm mx-auto text-center" style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.1)' }}>
                <p className="text-surface font-bold mb-1">
                  {winner === 'player' ? 'Sign up to keep your prize' : 'Sign up for a rematch'}
                </p>
                <p className="text-surface/40 text-sm mb-3">Battle real people for real deals</p>
                <Link href="/sign-up" className="inline-block bg-btc text-night font-bold px-6 py-2.5 rounded-full text-sm hover:bg-btc-dark transition">
                  Sign Up Free
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Share modal (desktop fallback) */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowShareModal(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative rounded-2xl p-6 max-w-sm w-full text-center" style={{ background: '#1a1230' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowShareModal(false)} className="absolute top-3 right-3 text-surface/30 hover:text-surface text-lg">&times;</button>
            <p className="text-surface font-bold mb-3">Share this challenge</p>
            <div className="bg-night rounded-xl px-4 py-3 mb-4">
              <p className="text-btc text-sm font-mono break-all">{typeof window !== 'undefined' ? `${window.location.origin}/battle/demo` : ''}</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/battle/demo`)
                setShowShareModal(false)
              }}
              className="bg-btc text-night font-bold px-6 py-2.5 rounded-full text-sm hover:bg-btc-dark transition"
            >
              Copy Link
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
