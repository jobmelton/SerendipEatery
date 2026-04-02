'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PrizeWheel } from '@/components/PrizeWheel'

const SAMPLE_DEALS = [
  { biz: 'Fuego Tacos', sale: 'Friday Flash Sale', status: 'Active Now', initial: 'F', soon: false,
    prizes: ['Free Taco', '20% Off', 'Free Guac', 'Free Drink', 'Try Again', '10% Off'] },
  { biz: 'Coffee Corner', sale: 'Morning Boost', status: 'Active Now', initial: 'C', soon: false,
    prizes: ['Free Coffee', 'Free Pastry', '50% Off', 'Try Again', 'Free Latte', '25% Off'] },
  { biz: 'Pizza Palace', sale: 'Lunch Rush', status: 'Active Now', initial: 'P', soon: false,
    prizes: ['Free Slice', 'Free Drink', '30% Off', 'Free Garlic Bread', 'Try Again', 'Free Dessert'] },
  { biz: 'Burger Barn', sale: 'Happy Hour', status: 'Starting Soon', initial: 'B', soon: true,
    prizes: ['Free Fries', 'Free Shake', '25% Off', 'Free Burger', 'Try Again', '10% Off'] },
]

/* Wheel is now the shared PrizeWheel component */

/* ─── Deal Modal using PrizeWheel ─── */
function DealModal({ deal, onClose }: { deal: typeof SAMPLE_DEALS[0]; onClose: () => void }) {
  const COLORS = ['#FF1493', '#32CD32', '#FF4500', '#2a2a2a', '#00CED1', '#9400D3', '#4169E1', '#FFD700']
  const dealPrizes = deal.prizes.map((label, i) => ({
    label,
    weight: label.toLowerCase().includes('try again') ? 25 : 12,
    color: COLORS[i % COLORS.length],
  }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-surface/30 hover:text-surface text-xl">&times;</button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-night text-xl" style={{ background: '#F7941D' }}>{deal.initial}</div>
          <h3 className="font-bold text-surface text-lg">{deal.biz} — {deal.sale}</h3>
        </div>
        <PrizeWheel prizes={dealPrizes} isGuest={true} />
      </div>
    </div>
  )
}

/* ─── Main Page ─── */
export default function LandingPage() {
  const [modalDeal, setModalDeal] = useState<typeof SAMPLE_DEALS[0] | null>(null)
  const [cowardToast, setCowardToast] = useState(false)


  return (
    <main className="min-h-screen bg-night flex flex-col items-center px-6 pt-12 pb-20">
      {/* ─── Roulette Wheel ─── */}
      <PrizeWheel />

      {/* Logo */}
      <div className="mb-3 flex flex-col items-end">
        <div style={{ fontSize: '2.5rem', lineHeight: 1, fontWeight: 900 }} className="font-display">
          <span className="text-btc">S</span><span className="text-surface">erendip</span>
        </div>
        <div className="font-display" style={{ fontSize: '2.3rem', lineHeight: 1, fontWeight: 900, transform: 'rotate(180deg)',
          background: 'linear-gradient(to right, transparent, #F7941D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginTop: '-0.1rem' }}>
          Eatery
        </div>
      </div>

      <p className="text-lg md:text-xl font-bold tracking-wider text-surface/50 mb-10">Spin. Win. Connect. Eat.</p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md mb-14">
        <Link href="/consumer" className="w-full sm:w-auto flex-1 bg-btc text-night font-bold text-lg px-8 py-4 rounded-full text-center hover:bg-btc-dark transition">I want deals</Link>
        <Link href="/business" className="w-full sm:w-auto flex-1 border-2 border-surface/20 text-surface/70 font-bold text-lg px-8 py-4 rounded-full text-center hover:border-surface/40 hover:text-surface transition">I have a business</Link>
      </div>

      {/* ─── How It Works Icons ─── */}
      <div className="flex items-center justify-center gap-10 md:gap-16 mb-10">
        {/* Spin: mini roulette wheel */}
        <div className="flex flex-col items-center gap-2">
          <svg width="36" height="36" viewBox="0 0 36 36">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a1 = i * 60, a2 = a1 + 60
              const r1 = ((a1 - 90) * Math.PI) / 180, r2 = ((a2 - 90) * Math.PI) / 180
              return <path key={i} d={`M18,18 L${18 + 14 * Math.cos(r1)},${18 + 14 * Math.sin(r1)} A14,14 0 0 1 ${18 + 14 * Math.cos(r2)},${18 + 14 * Math.sin(r2)} Z`}
                fill={i % 2 === 0 ? '#F7941D' : '#1a0e00'} stroke="#2a1400" strokeWidth="0.5" />
            })}
            <circle cx="18" cy="18" r="14.5" fill="none" stroke="#D4AF37" strokeWidth="1.5" />
            <circle cx="18" cy="18" r="4" fill="#1a0e00" stroke="#D4AF37" strokeWidth="1" />
          </svg>
          <span className="text-surface/50 text-xs font-bold">Spin</span>
        </div>
        {/* Win: gift box */}
        <div className="flex flex-col items-center gap-2">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <rect x="6" y="16" width="24" height="14" rx="2" fill="none" stroke="#F7941D" strokeWidth="2" />
            <rect x="4" y="12" width="28" height="6" rx="2" fill="none" stroke="#F7941D" strokeWidth="2" />
            <line x1="18" y1="12" x2="18" y2="30" stroke="#F7941D" strokeWidth="2" />
            <path d="M18,12 C18,8 14,6 12,8 C10,10 12,12 18,12" fill="none" stroke="#F7941D" strokeWidth="1.5" />
            <path d="M18,12 C18,8 22,6 24,8 C26,10 24,12 18,12" fill="none" stroke="#F7941D" strokeWidth="1.5" />
          </svg>
          <span className="text-surface/50 text-xs font-bold">Win</span>
        </div>
        {/* Connect: scissors hand */}
        <div className="flex flex-col items-center gap-2">
          <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(-45deg)' }}>
            <text x="18" y="20" textAnchor="middle" dominantBaseline="central" fontSize="26">✌️</text>
          </svg>
          <span className="text-surface/50 text-xs font-bold">Connect</span>
        </div>
        {/* Eat: plate with fork */}
        <div className="flex flex-col items-center gap-2">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="13" fill="none" stroke="#F7941D" strokeWidth="2" />
            <circle cx="18" cy="18" r="9" fill="none" stroke="#F7941D" strokeWidth="0.5" opacity="0.3" />
            <line x1="12" y1="8" x2="12" y2="28" stroke="#F7941D" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="8" x2="9" y2="14" stroke="#F7941D" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="15" y1="8" x2="15" y2="14" stroke="#F7941D" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="14" x2="15" y2="14" stroke="#F7941D" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-surface/50 text-xs font-bold">Eat</span>
        </div>
      </div>

      {/* Coward toast */}
      {cowardToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg bg-[#1a1230] border border-surface/20">
          <span className="text-surface font-bold">Coward 🐔</span>
        </div>
      )}

      {/* ─── RPS Challenge Card ─── */}
      <div
        className="w-full rounded-2xl p-6 mb-6 text-center animate-[cardPulse_2s_ease-in-out_infinite]"
        style={{ maxWidth: 360, background: '#1a0e00', border: '2px solid #F7941D', borderRadius: 16 }}
      >
        {/* Emoji row */}
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

        <h3 className="text-surface font-bold text-[1.3rem] mb-4">Challenge Dropped</h3>

        {/* Accept */}
        <Link href="/battle/demo"
          className="block w-full bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition mb-1">
          Accept
        </Link>
        <p className="text-surface/40 text-[11px] mb-3">Win and loot your challenger</p>

        {/* Back Down */}
        <button
          onClick={() => { setCowardToast(true); setTimeout(() => setCowardToast(false), 2000) }}
          className="block w-full border border-surface/15 text-surface/30 font-bold py-3 rounded-xl hover:text-surface/50 transition mb-1"
        >
          Back Down
        </button>
        <p className="text-surface/20 text-[11px]">Live with regrets forever</p>
      </div>

      {/* Drop a Challenge button */}
      <button
        onClick={() => {
          const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/battle/demo`
          const shareData = { title: 'SerendipEatery RPS Challenge', text: "I just dropped a Rock Paper Scissors challenge at SerendipEatery. Winner takes deals. You in? 👊", url }
          if (typeof navigator !== 'undefined' && navigator.share) {
            navigator.share(shareData).catch(() => {})
          } else if (typeof navigator !== 'undefined') {
            navigator.clipboard.writeText(url)
          }
        }}
        className="bg-btc/10 text-btc font-bold px-8 py-3 rounded-full text-sm border border-btc/30 hover:bg-btc/20 transition mb-14"
      >
        ✌️ Drop a Challenge
      </button>

      <style>{`
        @keyframes cardPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(247,148,29,0); }
          50% { box-shadow: 0 0 0 12px rgba(247,148,29,0); }
        }
        @keyframes rockPulse {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes paperPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes scissorsPulse {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
      `}</style>

      {/* ─── Clickable Deal Cards ─── */}
      <div className="w-full max-w-3xl">
        <h2 className="text-xl font-bold text-surface mb-4">Flash sales near you</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SAMPLE_DEALS.map((deal) => (
            <div
              key={deal.biz}
              className={`rounded-2xl p-5 ${deal.soon ? '' : 'cursor-pointer hover:border-btc/30'} transition`}
              style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.12)' }}
              onClick={() => { if (!deal.soon) setModalDeal(deal) }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-night shrink-0" style={{ background: '#F7941D' }}>{deal.initial}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-surface text-base truncate">{deal.biz}</h3>
                  <p className="text-surface/40 text-sm">{deal.sale}</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: deal.soon ? 'rgba(83,74,183,0.2)' : 'rgba(29,158,117,0.15)', color: deal.soon ? '#534AB7' : '#1D9E75' }}>
                  {deal.status}
                </span>
              </div>
              <button className={`block w-full text-center py-2.5 rounded-full text-sm font-bold transition ${deal.soon ? 'border border-surface/15 text-surface/40' : 'bg-btc text-night hover:bg-btc-dark'}`}>
                {deal.soon ? 'Coming Soon' : 'Spin to Win'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Deal modal */}
      {modalDeal && <DealModal deal={modalDeal} onClose={() => setModalDeal(null)} />}

      {/* App download */}
      <div className="flex items-center gap-4 mt-12">
        <Link href="/coming-soon-app" className="border border-surface/20 text-surface/50 text-sm px-5 py-2 rounded-full hover:border-surface/40 hover:text-surface/70 transition">Download for iOS</Link>
        <Link href="/coming-soon-app" className="border border-surface/20 text-surface/50 text-sm px-5 py-2 rounded-full hover:border-surface/40 hover:text-surface/70 transition">Download for Android</Link>
      </div>

      {/* Footer */}
      <footer className="mt-16 pt-8 border-t border-white/5 w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-surface/30 text-xs">
          <Link href="/pricing" className="hover:text-surface/50 transition">Pricing</Link>
          <Link href="/business" className="hover:text-surface/50 transition">Business</Link>
          <Link href="/consumer" className="hover:text-surface/50 transition">Consumer</Link>
          <Link href="/coming-soon-app" className="hover:text-surface/50 transition">Download App</Link>
          <button
            onClick={() => {
              const sd = { title: 'SerendipEatery', text: 'Spin to win deals at restaurants near you!', url: typeof window !== 'undefined' ? window.location.origin : 'https://serendip.app' }
              if (typeof navigator !== 'undefined' && navigator.share) navigator.share(sd).catch(() => {})
              else if (typeof navigator !== 'undefined') navigator.clipboard.writeText(sd.url)
            }}
            className="hover:text-surface/50 transition"
          >
            Tell a friend →
          </button>
        </div>
      </footer>
    </main>
  )
}
