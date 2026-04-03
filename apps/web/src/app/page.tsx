'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RouletteWheel, DEFAULT_PRIZES } from '@/components/RouletteWheel'

export default function LandingPage() {
  const [cowardToast, setCowardToast] = useState(false)
  const [wonPrize, setWonPrize] = useState<string | null>(null)

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
        if (prize.label !== 'Try Again') setWonPrize(prize.label)
        else setWonPrize(null)
      }} />

      {/* Win toast */}
      {wonPrize && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg animate-bounce" style={{ background: '#F7941D', color: '#1a0e00' }}>
          <span className="font-black text-lg">You won: {wonPrize}!</span>
        </div>
      )}

      {/* ─── More Deals ─── */}
      <Link href="/consumer" className="bg-btc text-night font-bold text-lg px-10 py-4 rounded-full text-center hover:bg-btc-dark transition mb-4">
        More Deals
      </Link>

      {/* ─── Drop a Challenge ─── */}
      <button
        onClick={() => {
          const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/battle/demo`
          const sd = { title: 'SerendipEatery RPS', text: "I just dropped a Rock Paper Scissors challenge. Winner takes deals. You in? 👊", url }
          if (typeof navigator !== 'undefined' && navigator.share) navigator.share(sd).catch(() => {})
          else if (typeof navigator !== 'undefined') navigator.clipboard.writeText(url)
        }}
        className="bg-btc/10 text-btc font-bold px-8 py-3 rounded-full text-sm border border-btc/30 hover:bg-btc/20 transition mb-8"
      >
        ✌️ Drop a Challenge
      </button>

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
