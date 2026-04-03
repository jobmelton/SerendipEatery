'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Move = 'rock' | 'paper' | 'scissors'
const MOVES: { key: Move; icon: string; label: string }[] = [
  { key: 'rock', icon: '✊', label: 'Rock' },
  { key: 'paper', icon: '✋', label: 'Paper' },
  { key: 'scissors', icon: '✌️', label: 'Scissors' },
]
const BEATS: Record<Move, Move> = { rock: 'scissors', scissors: 'paper', paper: 'rock' }

type Phase = 'loading' | 'waiting' | 'join' | 'countdown' | 'pick' | 'waitingMove' | 'roundResult' | 'done' | 'error' | 'expired'

const DEFAULT_MSG = "Accept the challenge and meet your fate — or decline and live with regret forever. 👊✋✌️"

function getGuestId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('se_guest_id')
  if (!id) {
    id = `guest_${crypto.randomUUID()}`
    localStorage.setItem('se_guest_id', id)
  }
  return id
}

function getGuestName(): string {
  if (typeof window === 'undefined') return 'Player'
  return localStorage.getItem('se_guest_name') || 'Player'
}

/* Audio helpers */
function playBeep(freq: number, dur: number) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'square'; osc.frequency.value = freq
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur)
  } catch {}
}
function playWinBeep() { playBeep(784, 0.15); setTimeout(() => playBeep(1047, 0.2), 150) }
function playLoseBeep() { playBeep(300, 0.3); setTimeout(() => playBeep(200, 0.4), 200) }

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

interface RoundResult {
  round: number
  challengerMove: string
  defenderMove: string
  winner: 'challenger' | 'defender' | 'draw'
  winnerId: string | null
}

interface BattleData {
  id: string
  challenger_id: string
  defender_id: string | null
  challenger_name: string | null
  defender_name: string | null
  challenger_message: string | null
  status: string
  current_round: number
  round_results: RoundResult[]
  winner_id: string | null
  expires_at: string | null
  created_at: string
}

export default function BattlePage() {
  const { id } = useParams<{ id: string }>()
  const [phase, setPhase] = useState<Phase>('loading')
  const [battle, setBattle] = useState<BattleData | null>(null)
  const [myId, setMyId] = useState('')
  const [myRole, setMyRole] = useState<'challenger' | 'defender' | null>(null)
  const [currentRound, setCurrentRound] = useState(1)
  const [myScore, setMyScore] = useState(0)
  const [oppScore, setOppScore] = useState(0)
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
  const [finalWinner, setFinalWinner] = useState<'win' | 'lose' | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [countdownText, setCountdownText] = useState('')
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [shareMsg, setShareMsg] = useState(DEFAULT_MSG)
  const [showShareModal, setShowShareModal] = useState(false)
  const [cowardToast, setCowardToast] = useState(false)
  const subscriptionRef = useRef<any>(null)

  const playerId = useRef('')

  // Initialize guest ID
  useEffect(() => {
    const gid = getGuestId()
    playerId.current = gid
    setMyId(gid)
  }, [])

  // Fetch battle state
  const fetchBattle = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/battles/${id}/state`)
      const json = await res.json()
      if (!json.ok) {
        setErrorMsg(json.error || 'Battle not found')
        setPhase('error')
        return null
      }
      return json.data.battle as BattleData
    } catch {
      setErrorMsg('Failed to connect')
      setPhase('error')
      return null
    }
  }, [id])

  // Initial load
  useEffect(() => {
    if (!id || !myId) return

    fetchBattle().then((b) => {
      if (!b) return
      setBattle(b)

      if (b.status === 'expired') {
        setPhase('expired')
      } else if (b.status === 'completed' || b.status === 'forfeit') {
        // Show final result
        loadFinalState(b)
      } else if (b.status === 'waiting') {
        if (b.challenger_id === myId) {
          setMyRole('challenger')
          setPhase('waiting')
        } else {
          setMyRole('defender')
          setPhase('join')
        }
      } else if (b.status === 'active') {
        // Determine role
        if (b.challenger_id === myId) setMyRole('challenger')
        else if (b.defender_id === myId) setMyRole('defender')
        else {
          setErrorMsg('This battle is already in progress')
          setPhase('error')
          return
        }
        resumeActiveGame(b)
      } else {
        setPhase('error')
        setErrorMsg('This challenge has ended')
      }
    })
  }, [id, myId, fetchBattle])

  // Subscribe to Realtime changes on this battle
  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`battle:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'battles',
        filter: `id=eq.${id}`,
      }, (payload: any) => {
        const updated = payload.new as BattleData
        setBattle(updated)
        handleBattleUpdate(updated)
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'battle_moves',
        filter: `battle_id=eq.${id}`,
      }, () => {
        // A move was inserted — re-fetch to get latest state
        fetchBattle().then((b) => {
          if (b) {
            setBattle(b)
            handleBattleUpdate(b)
          }
        })
      })
      .subscribe()

    subscriptionRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  function handleBattleUpdate(b: BattleData) {
    if (b.status === 'active' && phase === 'waiting') {
      // Opponent joined! Start the countdown
      setMyRole('challenger')
      setBattle(b)
      runCountdown(b)
    }

    if (b.status === 'active' && b.round_results && b.round_results.length > 0) {
      const latestRound = b.round_results[b.round_results.length - 1]
      const role = b.challenger_id === playerId.current ? 'challenger' : 'defender'

      // Count scores
      let cs = 0, ds = 0
      for (const r of b.round_results) {
        if (r.winner === 'challenger') cs++
        else if (r.winner === 'defender') ds++
      }
      setMyScore(role === 'challenger' ? cs : ds)
      setOppScore(role === 'challenger' ? ds : cs)

      // Show round result
      if (latestRound.round === currentRound && phase === 'waitingMove') {
        showRoundResultAnimation(latestRound, b)
      }
    }

    if (b.status === 'completed' || b.status === 'forfeit') {
      loadFinalState(b)
    }

    if (b.status === 'expired') {
      setPhase('expired')
    }
  }

  function loadFinalState(b: BattleData) {
    const role = b.challenger_id === playerId.current ? 'challenger' : 'defender'
    setMyRole(role)

    let cs = 0, ds = 0
    for (const r of (b.round_results || [])) {
      if (r.winner === 'challenger') cs++
      else if (r.winner === 'defender') ds++
    }
    setMyScore(role === 'challenger' ? cs : ds)
    setOppScore(role === 'challenger' ? ds : cs)

    if (b.winner_id === playerId.current) {
      setFinalWinner('win')
      playWinBeep()
    } else if (b.winner_id) {
      setFinalWinner('lose')
      playLoseBeep()
    }
    setPhase('done')
  }

  function resumeActiveGame(b: BattleData) {
    const role = b.challenger_id === playerId.current ? 'challenger' : 'defender'
    let cs = 0, ds = 0
    for (const r of (b.round_results || [])) {
      if (r.winner === 'challenger') cs++
      else if (r.winner === 'defender') ds++
    }
    setMyScore(role === 'challenger' ? cs : ds)
    setOppScore(role === 'challenger' ? ds : cs)
    setCurrentRound(b.current_round)
    setPhase('pick')
  }

  async function runCountdown(b: BattleData) {
    setPhase('countdown')
    playBeep(440, 0.15)
    setCountdownText('FIRST TO 3 WINS')
    await delay(1200)
    playBeep(523, 0.15)
    setCountdownText('READY...')
    await delay(800)
    playBeep(587, 0.15)
    setCountdownText('SET...')
    await delay(800)
    playBeep(784, 0.2)
    setCountdownText('GO!')
    await delay(500)
    setCurrentRound(b.current_round || 1)
    setPhase('pick')
  }

  async function handleJoin() {
    try {
      const res = await fetch(`${API_URL}/battles/${id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: myId, playerName: getGuestName() }),
      })
      const json = await res.json()
      if (!json.ok) {
        setErrorMsg(json.error || 'Failed to join')
        setPhase('error')
        return
      }
      setBattle(json.data)
      setMyRole('defender')
      runCountdown(json.data)
    } catch {
      setErrorMsg('Connection failed')
      setPhase('error')
    }
  }

  async function submitMove(move: Move) {
    setPhase('waitingMove')

    try {
      const res = await fetch(`${API_URL}/battles/${id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: myId, round: currentRound, move }),
      })
      const json = await res.json()
      if (!json.ok) {
        if (json.code === 'ALREADY_SUBMITTED') {
          // Already submitted, just wait
          return
        }
        setErrorMsg(json.error || 'Failed to submit move')
        setPhase('error')
        return
      }

      if (json.data.resolved) {
        // Both moves in — show result
        showRoundResultAnimation(json.data.roundResult, null)
      }
      // Otherwise wait for Realtime to notify us
    } catch {
      setErrorMsg('Connection failed')
      setPhase('error')
    }
  }

  async function showRoundResultAnimation(result: RoundResult, updatedBattle: BattleData | null) {
    setRoundResult(result)
    setPhase('roundResult')

    const role = myRole!
    const iWon = result.winner === role
    const iLost = result.winner !== 'draw' && result.winner !== role

    if (iWon) playWinBeep()
    else if (iLost) playLoseBeep()
    else playBeep(500, 0.2)

    // Update scores
    const b = updatedBattle || battle
    if (b?.round_results) {
      let cs = 0, ds = 0
      for (const r of b.round_results) {
        if (r.winner === 'challenger') cs++
        else if (r.winner === 'defender') ds++
      }
      setMyScore(role === 'challenger' ? cs : ds)
      setOppScore(role === 'challenger' ? ds : cs)
    }

    await delay(2000)

    // Check if match is over
    if (b && (b.status === 'completed' || b.status === 'forfeit')) {
      loadFinalState(b)
      return
    }

    // Re-fetch to check
    const latest = await fetchBattle()
    if (latest && (latest.status === 'completed' || latest.status === 'forfeit')) {
      setBattle(latest)
      loadFinalState(latest)
      return
    }

    // Next round
    const nextRound = currentRound + 1
    setCurrentRound(nextRound)
    setRoundResult(null)
    setPhase('pick')
  }

  async function handleCancel() {
    await fetch(`${API_URL}/battles/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: myId }),
    })
    window.location.href = '/'
  }

  async function handleForfeit() {
    await fetch(`${API_URL}/battles/${id}/forfeit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: myId }),
    })
  }

  function handleBackDown() {
    setCowardToast(true)
    setTimeout(() => setCowardToast(false), 2000)
    setTimeout(() => { window.location.href = '/' }, 1500)
  }

  const battleUrl = typeof window !== 'undefined' ? `${window.location.origin}/battle/${id}` : ''
  const challengeMessage = battle?.challenger_message || DEFAULT_MSG
  const opponentName = myRole === 'challenger' ? (battle?.defender_name || 'Opponent') : (battle?.challenger_name || 'Challenger')

  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6 relative">
      {/* Home button */}
      <button onClick={() => {
        if (phase === 'pick' || phase === 'waitingMove' || phase === 'roundResult') {
          setShowLeaveModal(true)
        } else {
          window.location.href = '/'
        }
      }} className="fixed top-4 left-4 z-40" style={{ color: '#a09080', fontSize: '0.9rem' }}>
        ← Home
      </button>

      {/* Score bar */}
      {(phase === 'pick' || phase === 'waitingMove' || phase === 'roundResult' || phase === 'done') && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-[#1a1230] rounded-full px-5 py-2">
          <span className="text-teal font-black text-lg">{myScore}</span>
          <span className="text-surface/30 text-xs">YOU — OPP</span>
          <span className="text-red-400 font-black text-lg">{oppScore}</span>
        </div>
      )}

      {/* Coward toast */}
      {cowardToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg bg-[#1a1230] border border-surface/20">
          <span className="text-surface font-bold">Coward 🐔</span>
        </div>
      )}

      {/* Leave modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowLeaveModal(false)} />
          <div className="relative rounded-2xl p-6 max-w-xs w-full text-center" style={{ background: '#1a1230' }}>
            <p className="text-surface font-bold mb-2">Leave battle?</p>
            <p className="text-red-400 text-sm mb-4">Leaving now forfeits the match.</p>
            <div className="flex gap-3">
              <button onClick={() => { handleForfeit(); window.location.href = '/' }} className="flex-1 bg-red-500/20 text-red-400 font-bold py-2.5 rounded-xl text-sm">Forfeit</button>
              <button onClick={() => setShowLeaveModal(false)} className="flex-1 bg-btc text-night font-bold py-2.5 rounded-xl text-sm">Stay</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── LOADING ─── */}
      {phase === 'loading' && (
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">✊✋✌️</div>
          <p className="text-surface/40">Loading battle...</p>
        </div>
      )}

      {/* ─── ERROR ─── */}
      {phase === 'error' && (
        <div className="text-center">
          <p className="text-red-400 text-xl font-bold mb-4">{errorMsg}</p>
          <Link href="/" className="text-btc hover:underline">← Go Home</Link>
        </div>
      )}

      {/* ─── EXPIRED ─── */}
      {phase === 'expired' && (
        <div className="text-center">
          <p className="text-3xl mb-2">⏰</p>
          <h2 className="text-2xl font-black text-surface mb-2">Challenge Expired</h2>
          <p className="text-surface/40 mb-6">This challenge has timed out.</p>
          <Link href="/" className="bg-btc text-night font-bold px-8 py-3 rounded-full">Home</Link>
        </div>
      )}

      {/* ─── WAITING (Challenger waiting for opponent) ─── */}
      {phase === 'waiting' && (
        <div className="text-center max-w-sm">
          {/* Challenge message */}
          <div className="mb-6 rounded-xl px-5 py-4 text-left" style={{ background: '#1a0e00', borderLeft: '4px solid #F7941D' }}>
            <p className="text-surface/80 text-sm italic leading-relaxed">{challengeMessage}</p>
          </div>

          <div className="text-4xl mb-4 animate-pulse">⏳</div>
          <h2 className="text-2xl font-black text-surface mb-2">Waiting for opponent...</h2>
          <p className="text-surface/40 text-sm mb-6">Share the link to start the battle</p>

          {/* Share buttons */}
          <div className="flex flex-col gap-3 mb-6 w-full">
            <button onClick={() => {
              const sd = { title: 'SerendipEatery Challenge', text: challengeMessage, url: battleUrl }
              if (navigator.share) navigator.share(sd).catch(() => {})
              else navigator.clipboard.writeText(`${challengeMessage}\n\n${battleUrl}`)
            }} className="w-full bg-btc text-night font-bold py-3 rounded-xl">
              📱 AirDrop / Share
            </button>
            <button onClick={() => {
              const smsUrl = `sms:?body=${encodeURIComponent(challengeMessage + '\n\nTap to battle: ' + battleUrl + '\n\nSerendipEatery — Spin. Win. Connect. Eat.')}`
              window.open(smsUrl, '_self')
            }} className="w-full border border-surface/20 text-surface/60 font-bold py-3 rounded-xl">
              💬 Send as Text
            </button>
          </div>

          {/* Battle URL display */}
          <div className="rounded-xl p-3 mb-6 break-all" style={{ background: '#1a1230' }}>
            <p className="text-surface/30 text-xs mb-1">Battle link:</p>
            <p className="text-btc text-xs">{battleUrl}</p>
          </div>

          <button onClick={handleCancel} className="text-surface/30 text-sm hover:text-surface/50 transition">
            Cancel Challenge
          </button>
        </div>
      )}

      {/* ─── JOIN (Player B sees challenge) ─── */}
      {phase === 'join' && (
        <div className="text-center max-w-sm">
          {/* Challenge message quote card */}
          <div className="mb-6 rounded-xl px-5 py-4 text-left" style={{ background: '#1a0e00', borderLeft: '4px solid #F7941D' }}>
            <p className="text-surface/80 text-sm italic leading-relaxed">{challengeMessage}</p>
          </div>

          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-3xl">✊</span>
            <span className="text-surface/20 text-xs font-bold">vs</span>
            <span className="text-3xl">✋</span>
            <span className="text-surface/20 text-xs font-bold">vs</span>
            <span className="text-3xl">✌️</span>
          </div>

          <h2 className="text-2xl font-black text-surface mb-1">
            {battle?.challenger_name || 'Someone'} dropped a challenge!
          </h2>
          <p className="text-surface/40 text-sm mb-8">First to 3 wins. Winner loots the loser.</p>

          <button onClick={handleJoin} className="w-full bg-btc text-night font-bold text-lg py-4 rounded-full hover:bg-btc-dark transition mb-3">
            Accept Challenge
          </button>
          <button onClick={handleBackDown} className="w-full border border-surface/15 text-surface/30 font-bold py-3 rounded-full hover:text-surface/50 transition mb-1">
            Back Down
          </button>
          <p className="text-surface/20 text-[11px]">Live with regrets forever</p>
        </div>
      )}

      {/* ─── COUNTDOWN ─── */}
      {phase === 'countdown' && (
        <div className="text-center">
          <p className="text-4xl md:text-5xl font-black text-btc animate-pulse" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            {countdownText}
          </p>
        </div>
      )}

      {/* ─── PICK MOVE ─── */}
      {phase === 'pick' && (
        <div className="text-center">
          <p className="text-surface/40 text-sm mb-2">Round {currentRound}</p>
          {currentRound >= 4 && myScore === 2 && oppScore === 2 && (
            <p className="text-red-400 font-black text-lg mb-2 animate-pulse">SUDDEN DEATH</p>
          )}
          {(myScore === 2 || oppScore === 2) && !(myScore === 2 && oppScore === 2) && (
            <p className="text-btc font-bold text-sm mb-2">Match point!</p>
          )}
          <div className="flex gap-6 justify-center">
            {MOVES.map((m) => (
              <button key={m.key} onClick={() => submitMove(m.key)}
                className="w-24 h-28 rounded-2xl flex flex-col items-center justify-center gap-1 transition hover:bg-white/10 active:scale-95"
                style={{
                  background: '#1a1230',
                  border: currentRound >= 4 && myScore === 2 && oppScore === 2
                    ? '2px solid rgba(239,68,68,0.3)'
                    : '1px solid rgba(247,148,29,0.15)',
                  minHeight: 80,
                }}>
                <span className="text-4xl">{m.icon}</span>
                <span className="text-surface/50 text-xs font-bold">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── WAITING FOR OPPONENT MOVE ─── */}
      {phase === 'waitingMove' && (
        <div className="text-center">
          <p className="text-surface/40 text-sm mb-4">Round {currentRound}</p>
          <div className="text-4xl mb-4 animate-bounce">✊</div>
          <p className="text-surface font-bold text-lg">Waiting for {opponentName}...</p>
          <div className="flex justify-center gap-1 mt-2">
            <span className="w-2 h-2 bg-btc rounded-full animate-[pulse_1s_ease-in-out_infinite]" />
            <span className="w-2 h-2 bg-btc rounded-full animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
            <span className="w-2 h-2 bg-btc rounded-full animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
          </div>
        </div>
      )}

      {/* ─── ROUND RESULT ─── */}
      {phase === 'roundResult' && roundResult && (
        <div className="text-center">
          <p className="text-surface/40 text-sm mb-4">Round {roundResult.round}</p>
          <div className="flex items-center justify-center gap-8 mb-6">
            <div className="text-center">
              <span className="text-6xl block" style={{ transform: 'rotate(90deg)' }}>
                {MOVES.find(m => m.key === (myRole === 'challenger' ? roundResult.challengerMove : roundResult.defenderMove))?.icon}
              </span>
              <span className="text-surface/40 text-xs mt-2 block">You</span>
            </div>
            <span className="text-surface/20 text-lg">vs</span>
            <div className="text-center">
              <span className="text-6xl block" style={{ transform: 'rotate(-90deg)' }}>
                {MOVES.find(m => m.key === (myRole === 'challenger' ? roundResult.defenderMove : roundResult.challengerMove))?.icon}
              </span>
              <span className="text-surface/40 text-xs mt-2 block">{opponentName}</span>
            </div>
          </div>
          <p className="text-3xl font-black" style={{
            color: roundResult.winner === myRole ? '#1D9E75'
              : roundResult.winner === 'draw' ? '#F7941D'
              : '#E53E3E'
          }}>
            {roundResult.winner === myRole ? 'YOU WIN THIS ROUND'
              : roundResult.winner === 'draw' ? 'DRAW'
              : 'YOU LOSE THIS ROUND'}
          </p>
        </div>
      )}

      {/* ─── FINAL RESULT ─── */}
      {phase === 'done' && (
        <div className="text-center">
          <p className={`text-4xl font-black mb-2 ${finalWinner === 'lose' ? 'animate-[shake_0.3s_ease]' : ''}`}
            style={{ color: finalWinner === 'win' ? '#FFD700' : '#E53E3E' }}>
            {finalWinner === 'win' ? 'YOU WIN! 🏆' : 'YOU LOSE 😤'}
          </p>
          <p className="text-surface/50 text-lg mb-2">{myScore} – {oppScore}</p>
          <p className="text-btc font-black text-lg animate-[floatUp_1.5s_ease-out_forwards] mb-6">
            +{finalWinner === 'win' ? '25' : '5'} pts
          </p>

          {/* Round history */}
          {battle?.round_results && (
            <div className="space-y-2 mb-6 max-w-xs mx-auto">
              {battle.round_results.map((r, i) => {
                const myMove = myRole === 'challenger' ? r.challengerMove : r.defenderMove
                const oppMove = myRole === 'challenger' ? r.defenderMove : r.challengerMove
                const iWon = r.winner === myRole
                const isDraw = r.winner === 'draw'
                return (
                  <div key={i} className="flex items-center justify-center gap-4 text-sm">
                    <span className="w-6 text-surface/30">R{r.round}</span>
                    <span className="text-xl" style={{ transform: 'rotate(90deg)' }}>{MOVES.find(m => m.key === myMove)?.icon}</span>
                    <span className="text-surface/20">vs</span>
                    <span className="text-xl" style={{ transform: 'rotate(-90deg)' }}>{MOVES.find(m => m.key === oppMove)?.icon}</span>
                    <span className="w-6 font-bold" style={{ color: iWon ? '#1D9E75' : isDraw ? '#888' : '#E53E3E' }}>
                      {iWon ? 'W' : isDraw ? '—' : 'L'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 items-center w-full max-w-xs mx-auto mb-6">
            <button onClick={() => setShowShareModal(true)} className="w-full border border-btc text-btc font-bold py-3 rounded-full hover:bg-btc/10 transition">
              ✌️ Drop a Challenge
            </button>
            <Link href="/" className="w-full text-center py-3 text-sm" style={{ color: '#a09080' }}>← Home</Link>
          </div>

          {/* Sign up CTA */}
          <div className="rounded-2xl p-5 max-w-sm mx-auto text-center" style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.1)' }}>
            <p className="text-surface font-bold mb-1">{finalWinner === 'win' ? 'Sign up to keep your winnings' : 'Sign up for a rematch'}</p>
            <p className="text-surface/40 text-sm mb-3">Battle real people for real deals</p>
            <Link href="/sign-up" className="inline-block bg-btc text-night font-bold px-6 py-2.5 rounded-full text-sm hover:bg-btc-dark transition">Sign Up Free</Link>
          </div>
        </div>
      )}

      {/* ─── Share Modal ─── */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowShareModal(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative rounded-2xl p-6 max-w-sm w-full" style={{ background: '#1a1230' }} onClick={(e) => e.stopPropagation()}>
            <p className="text-surface font-bold text-lg mb-3">Your Challenge Message</p>
            <textarea
              value={shareMsg}
              onChange={(e) => setShareMsg(e.target.value.slice(0, 150))}
              maxLength={150}
              rows={3}
              className="w-full text-surface rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none resize-none"
              style={{ background: '#1a0e00', border: '1px solid #F7941D' }}
            />
            <p className="text-surface/30 text-xs text-right mb-1">{shareMsg.length}/150</p>
            <button onClick={() => setShareMsg(DEFAULT_MSG)}
              className="text-surface/40 text-xs hover:text-surface/60 transition mb-4 block">Restore Default</button>
            <div className="flex flex-col gap-3">
              <button onClick={async () => {
                // Create a new battle then share
                try {
                  const res = await fetch(`${API_URL}/battles/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerId: myId, playerName: getGuestName(), message: shareMsg }),
                  })
                  const json = await res.json()
                  if (json.ok) {
                    const newUrl = `${window.location.origin}/battle/${json.data.id}`
                    const sd = { title: 'SerendipEatery Challenge', text: shareMsg, url: newUrl }
                    if (navigator.share) navigator.share(sd).catch(() => {})
                    else navigator.clipboard.writeText(`${shareMsg}\n\n${newUrl}`)
                  }
                } catch {}
                setShowShareModal(false)
              }} className="w-full bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition">
                📱 AirDrop / Share
              </button>
              <button onClick={async () => {
                try {
                  const res = await fetch(`${API_URL}/battles/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerId: myId, playerName: getGuestName(), message: shareMsg }),
                  })
                  const json = await res.json()
                  if (json.ok) {
                    const newUrl = `${window.location.origin}/battle/${json.data.id}`
                    const body = `${shareMsg}\n\nTap to battle: ${newUrl}\n\nSerendipEatery — Spin. Win. Connect. Eat.`
                    window.open(`sms:?body=${encodeURIComponent(body)}`, '_self')
                  }
                } catch {}
                setShowShareModal(false)
              }} className="w-full border border-surface/20 text-surface/60 font-bold py-3 rounded-xl hover:bg-white/5 transition">
                💬 Send as Text
              </button>
            </div>
            <button onClick={() => setShowShareModal(false)}
              className="w-full text-center text-surface/30 text-sm mt-3 hover:text-surface/50 transition">Cancel</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes floatUp { 0%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-30px)} }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
      `}</style>
    </main>
  )
}
