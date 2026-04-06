'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { RouletteWheel, type WheelPrize } from '@/components/RouletteWheel'

const RESTAURANT_PRIZES: WheelPrize[] = [
  { label: 'Taco Loco',    weight: 10, color: '#FF1493' },
  { label: 'Burger Bliss',  weight: 10, color: '#32CD32' },
  { label: 'Sushi Wave',    weight: 10, color: '#9400D3' },
  { label: 'Pizza Nova',    weight: 10, color: '#4169E1' },
  { label: 'Wok & Roll',    weight: 10, color: '#FF4500' },
  { label: 'Pho Real',      weight: 10, color: '#00CED1' },
  { label: 'Curry Up',      weight: 10, color: '#FF6347' },
  { label: 'Gyro Hero',     weight: 10, color: '#7B68EE' },
  { label: 'Bao Down',      weight: 10, color: '#00FA9A' },
  { label: 'Falafel King',  weight: 10, color: '#FFD700' },
]
import { WinCelebration } from '@/components/WinCelebration'
import { supabase } from '@/lib/supabase'
import { roundGPS } from '@/lib/pwa'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const DEFAULT_CHALLENGE_MSG = "Accept challenge and fate, or decline and live a life of regret. 👊✋✌️"

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
  const [showFallback, setShowFallback] = useState(false)
  const [fallbackUrl, setFallbackUrl] = useState('')
  const [fallbackText, setFallbackText] = useState('')
  const [copied, setCopied] = useState(false)

  // ─── Feature 1: GPS Proximity Room ─────────────────────────────────
  const [nearbyChallenges, setNearbyChallenges] = useState<Array<{ battleId: string; message: string; challengerName: string }>>([])
  const proximityChannelRef = useRef<any>(null)
  const cellRef = useRef<string>('')

  useEffect(() => {
    // Request GPS after 3 seconds
    const timer = setTimeout(() => {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const gps = roundGPS(pos.coords.latitude, pos.coords.longitude)
          cellRef.current = gps.cell

          // Join proximity channel
          const channel = supabase.channel(`proximity:${gps.cell}`)
          channel
            .on('broadcast', { event: 'challenge' }, (payload: any) => {
              const data = payload.payload
              setNearbyChallenges(prev => {
                if (prev.some(c => c.battleId === data.battleId)) return prev
                return [...prev, { battleId: data.battleId, message: data.message, challengerName: data.challengerName }]
              })
              // Auto-remove after 2 minutes
              setTimeout(() => {
                setNearbyChallenges(prev => prev.filter(c => c.battleId !== data.battleId))
              }, 120000)
            })
            .subscribe()

          // Track presence
          channel.track({ type: 'online', guestId: getGuestId(), timestamp: Date.now() })
          proximityChannelRef.current = channel
        },
        () => {}, // GPS denied — no proximity features
        { enableHighAccuracy: false, timeout: 5000 }
      )
    }, 3000)

    return () => {
      clearTimeout(timer)
      if (proximityChannelRef.current) supabase.removeChannel(proximityChannelRef.current)
    }
  }, [])

  // ─── Feature 2: Full Screen Challenge Display + WakeLock ───────────
  const [showHoldUp, setShowHoldUp] = useState(false)
  const [holdUpBattleId, setHoldUpBattleId] = useState('')
  const [holdUpUrl, setHoldUpUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrPulseGreen, setQrPulseGreen] = useState(false)
  const wakeLockRef = useRef<any>(null)

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
      }
    } catch {}
  }

  async function releaseWakeLock() {
    if (wakeLockRef.current) { await wakeLockRef.current.release(); wakeLockRef.current = null }
  }

  async function showChallengeHoldUp(battleId: string) {
    const url = `${window.location.origin}/battle/${battleId}`
    setHoldUpBattleId(battleId)
    setHoldUpUrl(url)
    setShowHoldUp(true)
    requestWakeLock()

    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 220,
        color: { dark: '#F7941D', light: '#0f0a1e' },
        margin: 1,
      })
      setQrDataUrl(dataUrl)
    } catch {}

    // Broadcast to proximity channel
    if (proximityChannelRef.current) {
      proximityChannelRef.current.send({
        type: 'broadcast',
        event: 'challenge',
        payload: { battleId, message: challengeMsg, challengerName: getGuestName() },
      })
    }

    // Watch for opponent accepting
    const channel = supabase.channel(`holdup:${battleId}`)
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'battles',
      filter: `id=eq.${battleId}`,
    }, (payload: any) => {
      if (payload.new?.status === 'active') {
        // Opponent accepted!
        setQrPulseGreen(true)
        setTimeout(() => {
          releaseWakeLock()
          setShowHoldUp(false)
          router.push(`/battle/${battleId}`)
        }, 1500)
        supabase.removeChannel(channel)
      }
    }).subscribe()
  }

  function exitHoldUp() {
    releaseWakeLock()
    setShowHoldUp(false)
    setQrPulseGreen(false)
    router.push(`/battle/${holdUpBattleId}`)
  }

  return (
    <>
    {/* ─── Full Screen Challenge Hold-Up ─── */}
    {showHoldUp && (
      <div className="fixed inset-0 z-[9999] bg-night flex flex-col items-center justify-center px-6">
        <button onClick={exitHoldUp} className="absolute top-4 right-4 text-surface/30 text-sm hover:text-surface/50">Exit</button>
        <p className="text-surface font-bold text-[1.8rem] mb-8">✊ Challenge Dropped</p>
        {qrDataUrl && (
          <img src={qrDataUrl} alt="QR Code" width={220} height={220}
            className={`rounded-xl mb-4 ${qrPulseGreen ? 'animate-[pulseGreen_0.3s_ease_3]' : ''}`}
            style={{ border: qrPulseGreen ? '3px solid #1D9E75' : '3px solid rgba(247,148,29,0.3)' }} />
        )}
        <p className="text-surface/40 text-sm mb-8">Scan to accept your fate</p>
        <div className="flex gap-3 mb-8">
          <button onClick={async (e) => {
            e.preventDefault()
            if (navigator.share) {
              try { await navigator.share({ title: 'SerendipEatery Challenge', text: challengeMsg, url: holdUpUrl }) } catch {}
            } else { setFallbackUrl(holdUpUrl); setFallbackText(challengeMsg); setShowFallback(true) }
          }} className="bg-btc text-night font-bold px-5 py-2.5 rounded-xl text-sm">AirDrop / Share</button>
          <a href={`sms:?body=${encodeURIComponent(challengeMsg + '\n\n' + holdUpUrl)}`}
            className="border border-surface/20 text-surface/60 font-bold px-5 py-2.5 rounded-xl text-sm">Send as Text</a>
          <button onClick={() => { navigator.clipboard.writeText(holdUpUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            className="border border-surface/20 text-surface/60 font-bold px-5 py-2.5 rounded-xl text-sm">
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-surface/30 text-sm">Waiting</span>
          <span className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-btc rounded-full animate-[pulse_1s_ease-in-out_infinite]" />
            <span className="w-1.5 h-1.5 bg-btc rounded-full animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
            <span className="w-1.5 h-1.5 bg-btc rounded-full animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
          </span>
        </div>
      </div>
    )}

    {/* ─── Nearby Challenges Card ─── */}
    {nearbyChallenges.length > 0 && !showHoldUp && (
      <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto">
        <div className="rounded-2xl p-4 space-y-2" style={{ background: '#1a0e00', border: '2px solid #F7941D', animation: 'pulse 2s ease-in-out infinite' }}>
          <p className="text-btc font-bold text-sm">{nearbyChallenges.length} challenge{nearbyChallenges.length > 1 ? 's' : ''} nearby</p>
          {nearbyChallenges.slice(0, 3).map(c => (
            <div key={c.battleId} className="flex items-center justify-between">
              <div>
                <p className="text-surface text-sm font-bold">{c.challengerName}</p>
                <p className="text-surface/40 text-xs truncate max-w-[200px]">{c.message}</p>
              </div>
              <Link href={`/battle/${c.battleId}`} className="bg-btc text-night font-bold px-4 py-1.5 rounded-full text-xs shrink-0">Accept</Link>
            </div>
          ))}
        </div>
      </div>
    )}

    <main className="min-h-screen bg-night flex flex-col items-center px-6 pt-10 pb-16">
      {/* ─── Logo ─── */}
      <div className="mb-2 flex flex-col items-end">
        <div style={{ fontSize: '2.5rem', lineHeight: 1, fontWeight: 900 }} className="font-display">
          <span className="text-btc">S</span><span className="text-surface">erendip</span>
        </div>
        <div className="font-display" style={{ fontSize: '2.3rem', lineHeight: 1, fontWeight: 900, transform: 'rotate(180deg)',
          background: 'linear-gradient(to left, #F7941D 0%, #F7941D 40%, transparent 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginTop: '-0.1rem' }}>
          Eatery
        </div>
      </div>

      {/* ─── Tagline ─── */}
      <p className="text-xl md:text-2xl font-bold tracking-wider text-surface/70 mb-1">Fate has good taste.</p>
      <p className="text-sm text-surface/30 mb-6">You didn't find it. It found you.</p>

      {/* ─── Roulette Wheel ─── */}
      <p className="text-surface/40 text-xs mb-2">You've earned a spin. Fate decides what's next.</p>
      <RouletteWheel prizes={RESTAURANT_PRIZES} onSpinComplete={(prize) => {
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
              <button disabled={creating} onClick={async (e) => {
                e.preventDefault()
                setCreating(true)
                try {
                  const res = await fetch(`${API_URL}/battles/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerId: getGuestId(), playerName: getGuestName(), message: challengeMsg }),
                  })
                  const json = await res.json()
                  if (!json.ok) return

                  const shareUrl = `${window.location.origin}/battle/${json.data.id}`

                  if (navigator.share) {
                    try {
                      await navigator.share({ title: 'SerendipEatery Challenge', text: challengeMsg, url: shareUrl })
                    } catch (err: any) {
                      if (err?.name !== 'AbortError') {
                        setFallbackUrl(shareUrl); setFallbackText(challengeMsg); setShowFallback(true)
                      }
                    }
                  } else {
                    setFallbackUrl(shareUrl); setFallbackText(challengeMsg); setShowFallback(true)
                  }
                  setShowChallengeComposer(false)
                  showChallengeHoldUp(json.data.id)
                } catch {
                  // Network error — still try to show the share fallback but don't use demo URL
                } finally { setCreating(false) }
              }} className="w-full bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition disabled:opacity-50">
                {creating ? 'Creating...' : '📱 AirDrop / Share'}
              </button>
              <button disabled={creating} onClick={async (e) => {
                e.preventDefault()
                setCreating(true)
                try {
                  const res = await fetch(`${API_URL}/battles/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerId: getGuestId(), playerName: getGuestName(), message: challengeMsg }),
                  })
                  const json = await res.json()
                  if (!json.ok) return

                  const shareUrl = `${window.location.origin}/battle/${json.data.id}`
                  const smsBody = `${challengeMsg}\n\nTap to battle: ${shareUrl}\n\nSerendipEatery — Fate has good taste.`
                  window.location.href = `sms:?body=${encodeURIComponent(smsBody)}`
                  setShowChallengeComposer(false)
                  // Don't router.push yet — SMS app opens first, user returns to this page
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

      {/* ─── Share Fallback Modal (desktop / no Web Share API) ─── */}
      {showFallback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowFallback(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative rounded-2xl p-6 max-w-sm w-full" style={{ background: '#1a1230' }} onClick={(e) => e.stopPropagation()}>
            <p className="text-surface font-bold text-lg mb-3">Share your challenge</p>
            <div className="rounded-lg p-3 mb-4 break-all" style={{ background: '#0f0a1e', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-btc text-xs">{fallbackUrl}</p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => {
                navigator.clipboard.writeText(`${fallbackText}\n\n${fallbackUrl}`)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }} className="w-full bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition">
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <a href={`sms:?body=${encodeURIComponent(fallbackText + '\n\nTap to battle: ' + fallbackUrl + '\n\nSerendipEatery — Fate has good taste.')}`}
                className="w-full border border-surface/20 text-surface/60 font-bold py-3 rounded-xl hover:bg-white/5 transition text-center block">
                💬 Send as Text
              </a>
            </div>
            <button onClick={() => setShowFallback(false)}
              className="w-full text-center text-surface/30 text-sm mt-3 hover:text-surface/50 transition">Close</button>
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
        <p className="text-btc/60 text-[11px] mb-4">A stranger nearby is feeling lucky. Are you?</p>

        <Link href="/battle/demo" className="block w-full bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition mb-1">
          Accept challenge and fate
        </Link>
        <p className="text-surface/40 text-[11px] mb-3">Winner takes the loser's stash</p>

        <button onClick={() => { setCowardToast(true); setTimeout(() => setCowardToast(false), 2000) }}
          className="block w-full border border-surface/15 text-surface/30 font-bold py-3 rounded-xl hover:text-surface/50 transition mb-1">
          Decline (live with it)
        </button>
        <p className="text-surface/20 text-[11px]">Fate remembers cowards</p>
      </div>

      <style>{`
        @keyframes cardPulse { 0%,100%{box-shadow:0 0 0 0 rgba(247,148,29,0)} 50%{box-shadow:0 0 0 12px rgba(247,148,29,0)} }
        @keyframes rockPulse { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes paperPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        @keyframes scissorsPulse { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
      `}</style>

      {/* ─── Business link (muted, bottom) ─── */}
      <Link href="/business" className="text-surface/25 text-sm hover:text-surface/40 transition mb-4">
        I own a restaurant or food truck →
      </Link>

      {/* Footer */}
      <footer className="mt-8 pt-6 border-t border-white/5 w-full max-w-md">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-surface/25 text-xs">
          <Link href="/pricing" className="hover:text-surface/40 transition">Pricing</Link>
          <Link href="/consumer" className="hover:text-surface/40 transition">Consumer</Link>
          <Link href="/coming-soon-app" className="hover:text-surface/40 transition">Download App</Link>
          <Link href="/tournament" className="hover:text-surface/40 transition">Tournaments</Link>
          <Link href="/accessibility" className="hover:text-surface/40 transition">Accessibility</Link>
          <button
            onClick={() => {
              const sd = { title: 'SerendipEatery', text: 'Fate has good taste. You didn\'t find it — it found you.', url: typeof window !== 'undefined' ? window.location.origin : '' }
              if (typeof navigator !== 'undefined' && navigator.share) navigator.share(sd).catch(() => {})
              else if (typeof navigator !== 'undefined') navigator.clipboard.writeText(sd.url)
            }}
            className="hover:text-surface/40 transition"
          >Tell a friend →</button>
        </div>
      </footer>
    </main>
    <style>{`
      @keyframes pulseGreen {
        0%, 100% { border-color: rgba(29,158,117,0.3); }
        50% { border-color: #1D9E75; box-shadow: 0 0 20px rgba(29,158,117,0.5); }
      }
    `}</style>
    </>
  )
}
