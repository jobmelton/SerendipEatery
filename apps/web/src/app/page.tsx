'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RouletteWheel, type WheelPrize } from '@/components/RouletteWheel'
import { WinCelebration } from '@/components/WinCelebration'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const DEFAULT_CHALLENGE_MSG = "Accept the challenge and meet your fate — or decline and live with regret forever. 👊✋✌️"

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
  if (typeof window === 'undefined') return 'Challenger'
  return localStorage.getItem('se_guest_name') || 'Challenger'
}

export default function LandingPage() {
  const router = useRouter()
  const [cowardToast, setCowardToast] = useState(false)
  const [celebration, setCelebration] = useState<{ prize: string; color: string; isTryAgain: boolean } | null>(null)
  const [showChallengeComposer, setShowChallengeComposer] = useState(false)
  const [challengeMsg, setChallengeMsg] = useState(DEFAULT_CHALLENGE_MSG)
  const [creating, setCreating] = useState(false)

  return (
    <main className="min-h-screen bg-night flex flex-col items-center px-6 pt-10 pb-16">
      {/* ─── Logo ─── */}
      <div className="mb-2 flex flex-col items-end">
        <div style={{ fontSize: '2.5rem', lineHeight: 1, fontWeight: 900 }} className="font-display">
          <span className="text-btc">S</span><span className="text-surface">erendip</span>
        </div>
        <div className="font-display" style={{ fontSize: '2.3rem', lineHeight: 1, fontWeight: 900, transform: 'rotate(180deg)',
          background: 'linear-gradient(to right, transparent, #F7941D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginTop: '-0.1rem' }}>
          Eatery
        </div>
      </div>

      {/* ─── Tagline ─── */}
      <p className="text-lg md:text-xl font-bold tracking-wider text-surface/50 mb-6">Spin. Win. Connect. Eat.</p>

      {/* ─── Roulette Wheel ─── */}
      <RouletteWheel onSpinComplete={(prize) => {
        setCelebration({
          prize: prize.label,
          color: prize.color,
          isTryAgain: prize.label === 'Try Again',
        })
      }} />

      {/* Win celebration */}
      {celebration && (
        <WinCelebration
          prize={celebration.prize}
          prizeColor={celebration.color}
          isGuest={true}
          isTryAgain={celebration.isTryAgain}
          onDismiss={() => setCelebration(null)}
        />
      )}

      {/* ─── More Deals ─── */}
      <Link href="/consumer" className="bg-btc text-night font-bold text-lg px-10 py-4 rounded-full text-center hover:bg-btc-dark transition mb-4">
        More Deals
      </Link>

      {/* ─── Drop a Challenge ─── */}
      <button
        onClick={() => { setChallengeMsg(DEFAULT_CHALLENGE_MSG); setShowChallengeComposer(true) }}
        className="bg-btc/10 text-btc font-bold px-8 py-3 rounded-full text-sm border border-btc/30 hover:bg-btc/20 transition mb-8"
      >
        <span style={{ display: 'inline-block', transform: 'rotate(-45deg)' }}>✌️</span> Drop a Challenge
      </button>

      {/* ─── Challenge Composer Modal ─── */}
      {showChallengeComposer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowChallengeComposer(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative rounded-2xl p-6 max-w-sm w-full" style={{ background: '#1a1230' }} onClick={(e) => e.stopPropagation()}>
            <p className="text-surface font-bold text-lg mb-3">Your Challenge Message</p>
            <textarea
              value={challengeMsg}
              onChange={(e) => setChallengeMsg(e.target.value.slice(0, 150))}
              maxLength={150}
              rows={3}
              className="w-full text-surface rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none resize-none"
              style={{ background: '#1a0e00', border: '1px solid #F7941D' }}
            />
            <p className="text-surface/30 text-xs text-right mb-1">{challengeMsg.length}/150</p>
            <button onClick={() => setChallengeMsg(DEFAULT_CHALLENGE_MSG)}
              className="text-surface/40 text-xs hover:text-surface/60 transition mb-4 block">Restore Default</button>
            <div className="flex flex-col gap-3">
              <button disabled={creating} onClick={async () => {
                setCreating(true)
                try {
                  const res = await fetch(`${API_URL}/battles/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerId: getGuestId(), playerName: getGuestName(), message: challengeMsg }),
                  })
                  const json = await res.json()
                  if (json.ok) {
                    const battleUrl = `${window.location.origin}/battle/${json.data.id}`
                    const sd = { title: 'SerendipEatery Challenge', text: challengeMsg, url: battleUrl }
                    if (navigator.share) await navigator.share(sd).catch(() => {})
                    else navigator.clipboard.writeText(`${challengeMsg}\n\n${battleUrl}`)
                    setShowChallengeComposer(false)
                    router.push(`/battle/${json.data.id}`)
                  }
                } catch {} finally { setCreating(false) }
              }} className="w-full bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition disabled:opacity-50">
                {creating ? 'Creating...' : '📱 AirDrop / Share'}
              </button>
              <button disabled={creating} onClick={async () => {
                setCreating(true)
                try {
                  const res = await fetch(`${API_URL}/battles/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerId: getGuestId(), playerName: getGuestName(), message: challengeMsg }),
                  })
                  const json = await res.json()
                  if (json.ok) {
                    const battleUrl = `${window.location.origin}/battle/${json.data.id}`
                    const smsBody = `${challengeMsg}\n\nTap to battle: ${battleUrl}\n\nSerendipEatery — Spin. Win. Connect. Eat.`
                    window.open(`sms:?body=${encodeURIComponent(smsBody)}`, '_self')
                    setShowChallengeComposer(false)
                    router.push(`/battle/${json.data.id}`)
                  }
                } catch {} finally { setCreating(false) }
              }} className="w-full border border-surface/20 text-surface/60 font-bold py-3 rounded-xl hover:bg-white/5 transition disabled:opacity-50">
                {creating ? 'Creating...' : '💬 Send as Text'}
              </button>
            </div>
            <button onClick={() => setShowChallengeComposer(false)}
              className="w-full text-center text-surface/30 text-sm mt-3 hover:text-surface/50 transition">Cancel</button>
          </div>
        </div>
      )}

      {/* ─── RPS Challenge Card ─── */}
      {cowardToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg bg-[#1a1230] border border-surface/20">
          <span className="text-surface font-bold">Coward 🐔</span>
        </div>
      )}

      <div
        className="w-full rounded-2xl p-6 mb-8 text-center animate-[cardPulse_2s_ease-in-out_infinite]"
        style={{ maxWidth: 360, background: '#1a0e00', border: '2px solid #F7941D', borderRadius: 16 }}
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="flex flex-col items-center">
            <span className="text-3xl animate-[rockPulse_1.8s_ease-in-out_infinite]" style={{ display: 'inline-block' }}>✊</span>
            <span className="text-surface/40 text-[11px] uppercase tracking-wider mt-1">Rock</span>
          </div>
          <span className="text-surface/20 text-xs font-bold">vs</span>
          <div className="flex flex-col items-center">
            <span className="text-3xl animate-[paperPulse_1.8s_ease-in-out_infinite]" style={{ display: 'inline-block' }}>🤚</span>
            <span className="text-surface/40 text-[11px] uppercase tracking-wider mt-1">Paper</span>
          </div>
          <span className="text-surface/20 text-xs font-bold">vs</span>
          <div className="flex flex-col items-center">
            <span className="text-3xl animate-[scissorsPulse_1.8s_ease-in-out_infinite]" style={{ display: 'inline-block' }}>✌️</span>
            <span className="text-surface/40 text-[11px] uppercase tracking-wider mt-1">Scissors</span>
          </div>
        </div>

        <h3 className="text-surface font-bold text-[1.3rem] mb-1">Challenge Dropped</h3>
        <p className="text-btc/60 text-[11px] mb-4">Drop a challenge — earn 15 points</p>

        <Link href="/battle/demo" className="block w-full bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition mb-1">
          Accept
        </Link>
        <p className="text-surface/40 text-[11px] mb-3">Win and loot your challenger</p>

        <button onClick={() => { setCowardToast(true); setTimeout(() => setCowardToast(false), 2000) }}
          className="block w-full border border-surface/15 text-surface/30 font-bold py-3 rounded-xl hover:text-surface/50 transition mb-1">
          Back Down
        </button>
        <p className="text-surface/20 text-[11px]">Live with regrets forever</p>
      </div>

      <style>{`
        @keyframes cardPulse { 0%,100%{box-shadow:0 0 0 0 rgba(247,148,29,0)} 50%{box-shadow:0 0 0 12px rgba(247,148,29,0)} }
        @keyframes rockPulse { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes paperPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        @keyframes scissorsPulse { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
      `}</style>

      {/* ─── Business link (muted, bottom) ─── */}
      <Link href="/business" className="text-surface/25 text-sm hover:text-surface/40 transition mb-4">
        I have a business →
      </Link>

      {/* Footer */}
      <footer className="mt-8 pt-6 border-t border-white/5 w-full max-w-md">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-surface/25 text-xs">
          <Link href="/pricing" className="hover:text-surface/40 transition">Pricing</Link>
          <Link href="/consumer" className="hover:text-surface/40 transition">Consumer</Link>
          <Link href="/coming-soon-app" className="hover:text-surface/40 transition">Download App</Link>
          <button
            onClick={() => {
              const sd = { title: 'SerendipEatery', text: 'Spin to win deals at restaurants near you!', url: typeof window !== 'undefined' ? window.location.origin : '' }
              if (typeof navigator !== 'undefined' && navigator.share) navigator.share(sd).catch(() => {})
              else if (typeof navigator !== 'undefined') navigator.clipboard.writeText(sd.url)
            }}
            className="hover:text-surface/40 transition"
          >Tell a friend →</button>
        </div>
      </footer>
    </main>
  )
}
