'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

type Move = 'rock' | 'paper' | 'scissors'
const MOVES: { key: Move; icon: string; label: string }[] = [
  { key: 'rock', icon: '✊', label: 'Rock' },
  { key: 'paper', icon: '✋', label: 'Paper' },
  { key: 'scissors', icon: '✌️', label: 'Scissors' },
]
const BEATS: Record<Move, Move> = { rock: 'scissors', scissors: 'paper', paper: 'rock' }

type Phase = 'pick' | 'intro' | 'round' | 'nextPick' | 'suddenDeath' | 'done'

/* ─── Retro Audio ─── */
function playBeep(freq: number, dur: number) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur)
  } catch {}
}

/* ─── Speech Synthesis ─── */
function speak(text: string, opts: { rate?: number; pitch?: number } = {}) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const u = new SpeechSynthesisUtterance(text)
    u.rate = opts.rate ?? 0.9
    u.pitch = opts.pitch ?? 1.2
    u.volume = 1
    window.speechSynthesis.speak(u)
  } catch {}
}

const WIN_PHRASES = ['Nice!', 'Good move!', 'Boom!']
const LOSE_PHRASES = ['Ooh!', 'Tough break!', 'Ouch!']
function randomPick(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)] }

function playIntroSequence(onDone: () => void) {
  // FIRST TO 3 WINS — ascending
  setTimeout(() => playBeep(440, 0.15), 0)
  setTimeout(() => playBeep(494, 0.15), 200)
  setTimeout(() => playBeep(523, 0.15), 400)
  setTimeout(() => playBeep(587, 0.3), 600)
  // READY
  setTimeout(() => { playBeep(659, 0.1); playBeep(587, 0.1); playBeep(523, 0.1) }, 1500)
  // SET
  setTimeout(() => { playBeep(523, 0.1); playBeep(659, 0.1) }, 2500)
  // GO — triumphant
  setTimeout(() => { playBeep(523, 0.1); playBeep(659, 0.1); playBeep(784, 0.1); playBeep(1047, 0.2) }, 3500)
  setTimeout(onDone, 4200)
}

function playWinBeep() { playBeep(784, 0.15); setTimeout(() => playBeep(1047, 0.2), 150) }
function playLoseBeep() { playBeep(300, 0.3); setTimeout(() => playBeep(200, 0.4), 200) }

function resolveRound(a: Move, b: Move): 'win' | 'lose' | 'draw' {
  if (a === b) return 'draw'
  return BEATS[a] === b ? 'win' : 'lose'
}

function cpuMove(): Move {
  return (['rock', 'paper', 'scissors'] as Move[])[Math.floor(Math.random() * 3)]
}

export default function DemoBattlePage() {
  const [phase, setPhase] = useState<Phase>('pick')
  const [muted, setMuted] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('rps_muted') === 'true'
    return false
  })
  const [introText, setIntroText] = useState('')
  const [rounds, setRounds] = useState<Array<{ my: Move; opp: Move; result: string }>>([])
  const [myScore, setMyScore] = useState(0)
  const [oppScore, setOppScore] = useState(0)
  const [currentRound, setCurrentRound] = useState(0)
  const [roundResult, setRoundResult] = useState<{ my: Move; opp: Move; text: string; color: string } | null>(null)
  const [finalResult, setFinalResult] = useState<'win' | 'lose' | null>(null)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [shareMsg, setShareMsg] = useState("Accept and meet your fate — or decline and regret it for life 👊✋✌️")
  const [showShareCustom, setShowShareCustom] = useState(false)
  const myScoreRef = useRef(0)
  const oppScoreRef = useRef(0)
  const roundRef = useRef(0)

  const isMidGame = phase !== 'pick' && phase !== 'done'

  const startMatch = (firstMove: Move) => {
    myScoreRef.current = 0
    oppScoreRef.current = 0
    roundRef.current = 0
    setMyScore(0); setOppScore(0); setRounds([]); setCurrentRound(0)
    setFinalResult(null); setRoundResult(null)

    // Show intro sequence with voice
    setPhase('intro')
    setIntroText('FIRST TO 3 WINS')
    if (!muted) {
      playIntroSequence(() => {})
      speak('First to 3 wins!', { rate: 0.8, pitch: 1.3 })
    }
    setTimeout(() => { setIntroText('READY...'); if (!muted) speak('Ready', { rate: 0.7, pitch: 1.0 }) }, 1200)
    setTimeout(() => { setIntroText('SET...'); if (!muted) speak('Set', { rate: 0.7, pitch: 1.1 }) }, 1800)
    setTimeout(() => { setIntroText('GO!'); if (!muted) speak('Go!', { rate: 1.2, pitch: 1.5 }) }, 2400)
    setTimeout(() => playRound(firstMove), 3000)
  }

  const playRound = (myMove: Move) => {
    const opp = cpuMove()
    const result = resolveRound(myMove, opp)
    const rn = roundRef.current + 1
    roundRef.current = rn
    setCurrentRound(rn)

    let ms = myScoreRef.current
    let os = oppScoreRef.current
    if (result === 'win') {
      ms++; myScoreRef.current = ms
      if (!muted) { playWinBeep(); speak(randomPick(WIN_PHRASES), { rate: 1.1, pitch: 1.3 }) }
    } else if (result === 'lose') {
      os++; oppScoreRef.current = os
      if (!muted) { playLoseBeep(); speak(randomPick(LOSE_PHRASES), { rate: 0.9, pitch: 0.9 }) }
    } else {
      if (!muted) speak('Draw!', { rate: 0.9, pitch: 1.0 })
    }
    setMyScore(ms); setOppScore(os)

    const newRound = { my: myMove, opp, result }
    setRounds((prev) => [...prev, newRound])
    setRoundResult({
      my: myMove, opp,
      text: result === 'win' ? 'YOU WIN THIS ROUND' : result === 'lose' ? 'YOU LOSE THIS ROUND' : 'DRAW',
      color: result === 'win' ? '#1D9E75' : result === 'lose' ? '#E53E3E' : '#F7941D',
    })
    setPhase('round')

    // Check for match end
    setTimeout(() => {
      if (ms >= 3) {
        setFinalResult('win'); setPhase('done')
        if (!muted) { playWinBeep(); speak('You win! Amazing!', { rate: 1.1, pitch: 1.4 }) }
      } else if (os >= 3) {
        setFinalResult('lose'); setPhase('done')
        if (!muted) { playLoseBeep(); speak('You lose! Better luck next time!', { rate: 0.7, pitch: 0.8 }) }
      } else if (ms === 2 && os === 2 && rn >= 4) {
        setPhase('suddenDeath')
        if (!muted) speak('Sudden death!', { rate: 0.6, pitch: 0.9 })
      } else {
        // Check for match point
        if ((ms === 2 || os === 2) && !muted) speak('Match point!', { rate: 0.7, pitch: 1.0 })
        setPhase('nextPick')
      }
    }, 1500)
  }

  const resetGame = () => {
    setPhase('pick'); setRounds([]); setMyScore(0); setOppScore(0)
    setCurrentRound(0); setFinalResult(null); setRoundResult(null)
    myScoreRef.current = 0; oppScoreRef.current = 0; roundRef.current = 0
  }

  const doShare = () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/battle/demo`
    const sd = { title: 'SerendipEatery RPS', text: shareMsg, url }
    if (navigator.share) navigator.share(sd).catch(() => {})
    else navigator.clipboard.writeText(`${shareMsg} ${url}`)
  }

  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6 relative">
      {/* Mute button */}
      <button onClick={() => { const v = !muted; setMuted(v); localStorage.setItem('rps_muted', String(v)) }} className="fixed top-4 right-4 z-40 text-xl" title={muted ? 'Unmute' : 'Mute'}>
        {muted ? '🔇' : '🔊'}
      </button>

      {/* Exit */}
      <button onClick={() => isMidGame ? setShowLeaveModal(true) : (window.location.href = '/')}
        className="fixed top-4 left-4 z-40" style={{ color: '#a09080', fontSize: '0.9rem' }}>← Home</button>

      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowLeaveModal(false)} />
          <div className="relative rounded-2xl p-6 max-w-xs w-full text-center" style={{ background: '#1a1230' }}>
            <p className="text-surface font-bold mb-4">Leave battle?</p>
            <div className="flex gap-3">
              <button onClick={() => { window.location.href = '/' }} className="flex-1 bg-red-500/20 text-red-400 font-bold py-2.5 rounded-xl text-sm">Yes</button>
              <button onClick={() => setShowLeaveModal(false)} className="flex-1 bg-btc text-night font-bold py-2.5 rounded-xl text-sm">Stay</button>
            </div>
          </div>
        </div>
      )}

      {/* Score bar */}
      {phase !== 'pick' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-[#1a1230] rounded-full px-5 py-2">
          <span className="text-teal font-black text-lg">{myScore}</span>
          <span className="text-surface/30 text-xs">YOU — OPP</span>
          <span className="text-red-400 font-black text-lg">{oppScore}</span>
        </div>
      )}

      {/* ─── PICK FIRST MOVE ─── */}
      {phase === 'pick' && (
        <div className="text-center">
          <h1 className="text-2xl font-black text-surface mb-2">Pick your opening move</h1>
          <p className="text-surface/40 text-sm mb-8">First to 3 wins</p>
          <div className="flex gap-6 justify-center">
            {MOVES.map((m) => (
              <button key={m.key} onClick={() => startMatch(m.key)}
                className="w-28 h-32 rounded-2xl flex flex-col items-center justify-center gap-2 transition hover:bg-white/10 active:scale-95"
                style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.2)' }}>
                <span className="text-5xl">{m.icon}</span>
                <span className="text-surface/50 text-xs font-bold">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── INTRO SEQUENCE ─── */}
      {phase === 'intro' && (
        <div className="text-center">
          <p className="text-4xl md:text-5xl font-black text-btc animate-pulse" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            {introText}
          </p>
        </div>
      )}

      {/* ─── ROUND RESULT ─── */}
      {phase === 'round' && roundResult && (
        <div className="text-center">
          <p className="text-surface/40 text-sm mb-4">Round {currentRound}</p>
          <div className="flex items-center justify-center gap-8 mb-6">
            <span className="text-6xl" style={{ transform: 'rotate(90deg)' }}>
              {MOVES.find((m) => m.key === roundResult.my)?.icon}
            </span>
            <span className="text-surface/20 text-lg">vs</span>
            <span className="text-6xl" style={{ transform: 'rotate(-90deg)' }}>
              {MOVES.find((m) => m.key === roundResult.opp)?.icon}
            </span>
          </div>
          <p className="text-3xl font-black" style={{ color: roundResult.color }}>
            {roundResult.text}
          </p>
        </div>
      )}

      {/* ─── NEXT PICK ─── */}
      {phase === 'nextPick' && (
        <div className="text-center">
          <p className="text-surface/40 text-sm mb-2">Pick round {currentRound + 1}</p>
          <div className="flex gap-6 justify-center">
            {MOVES.map((m) => (
              <button key={m.key} onClick={() => playRound(m.key)}
                className="w-24 h-28 rounded-2xl flex flex-col items-center justify-center gap-1 transition hover:bg-white/10 active:scale-95"
                style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.15)' }}>
                <span className="text-4xl">{m.icon}</span>
                <span className="text-surface/50 text-xs font-bold">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── SUDDEN DEATH ─── */}
      {phase === 'suddenDeath' && (
        <div className="text-center">
          <p className="text-3xl font-black text-red-400 mb-6 animate-pulse" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            SUDDEN DEATH
          </p>
          <p className="text-surface/40 text-sm mb-4">One move — winner takes all</p>
          <div className="flex gap-6 justify-center">
            {MOVES.map((m) => (
              <button key={m.key} onClick={() => playRound(m.key)}
                className="w-24 h-28 rounded-2xl flex flex-col items-center justify-center gap-1 transition hover:bg-white/10 active:scale-95 border-2 border-red-500/30"
                style={{ background: '#1a1230' }}>
                <span className="text-4xl">{m.icon}</span>
                <span className="text-surface/50 text-xs font-bold">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── FINAL RESULT ─── */}
      {phase === 'done' && (
        <div className="text-center">
          <p className={`text-4xl font-black mb-2 ${finalResult === 'lose' ? 'animate-[shake_0.3s_ease]' : ''}`}
            style={{ color: finalResult === 'win' ? '#FFD700' : '#E53E3E' }}>
            {finalResult === 'win' ? 'YOU WIN! 🏆' : 'YOU LOSE 😤'}
          </p>
          <p className="text-surface/50 text-lg mb-2">{myScore} – {oppScore}</p>
          <p className="text-btc font-black text-lg animate-[floatUp_1.5s_ease-out_forwards] mb-6">
            +{finalResult === 'win' ? '25' : '5'} pts
          </p>

          {/* Round history */}
          <div className="space-y-2 mb-6 max-w-xs mx-auto">
            {rounds.map((r, i) => (
              <div key={i} className="flex items-center justify-center gap-4 text-sm">
                <span className="w-6 text-surface/30">R{i + 1}</span>
                <span className="text-xl" style={{ transform: 'rotate(90deg)' }}>{MOVES.find((m) => m.key === r.my)?.icon}</span>
                <span className="text-surface/20">vs</span>
                <span className="text-xl" style={{ transform: 'rotate(-90deg)' }}>{MOVES.find((m) => m.key === r.opp)?.icon}</span>
                <span className="w-6 font-bold" style={{ color: r.result === 'win' ? '#1D9E75' : r.result === 'lose' ? '#E53E3E' : '#888' }}>
                  {r.result === 'win' ? 'W' : r.result === 'lose' ? 'L' : '—'}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 items-center w-full max-w-xs mx-auto mb-6">
            <button onClick={resetGame} className="w-full bg-btc text-night font-bold py-3 rounded-full hover:bg-btc-dark transition">Play Again</button>
            <button onClick={() => setShowShareCustom(true)} className="w-full border border-btc text-btc font-bold py-3 rounded-full hover:bg-btc/10 transition">
              ✌️ Drop a Challenge
            </button>
            <Link href="/" className="w-full text-center py-3 text-sm" style={{ color: '#a09080' }}>← Home</Link>
          </div>

          {/* Sign up CTA */}
          <div className="rounded-2xl p-5 max-w-sm mx-auto text-center" style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.1)' }}>
            <p className="text-surface font-bold mb-1">{finalResult === 'win' ? 'Sign up to keep your prize' : 'Sign up for a rematch'}</p>
            <p className="text-surface/40 text-sm mb-3">Battle real people for real deals</p>
            <Link href="/sign-up" className="inline-block bg-btc text-night font-bold px-6 py-2.5 rounded-full text-sm hover:bg-btc-dark transition">Sign Up Free</Link>
          </div>
        </div>
      )}

      {/* ─── Share Customizer Modal ─── */}
      {showShareCustom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowShareCustom(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative rounded-2xl p-6 max-w-sm w-full" style={{ background: '#1a1230' }} onClick={(e) => e.stopPropagation()}>
            <p className="text-surface font-bold mb-2">Customize your challenge</p>
            <textarea
              value={shareMsg}
              onChange={(e) => setShareMsg(e.target.value.slice(0, 150))}
              maxLength={150}
              rows={3}
              className="w-full bg-night text-surface border border-white/10 rounded-lg px-3 py-2 text-sm mb-1 focus:border-btc focus:outline-none resize-none"
            />
            <p className="text-surface/20 text-xs mb-3">{shareMsg.length}/150</p>
            <button onClick={() => setShareMsg("Accept and meet your fate — or decline and regret it for life 👊✋✌️")}
              className="text-btc text-xs hover:underline mb-4 block">Restore default</button>
            <div className="flex gap-3">
              <button onClick={() => { doShare(); setShowShareCustom(false) }}
                className="flex-1 bg-btc text-night font-bold py-3 rounded-xl">📱 Share</button>
              <button onClick={() => {
                const url = `${window.location.origin}/battle/demo`
                window.open(`sms:?body=${encodeURIComponent(shareMsg + ' ' + url)}`, '_self')
                setShowShareCustom(false)
              }} className="flex-1 border border-surface/20 text-surface/60 font-bold py-3 rounded-xl">💬 Text</button>
            </div>
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
