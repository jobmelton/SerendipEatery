'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useUser, SignInButton } from '@clerk/nextjs'
import { loadStripe } from '@stripe/stripe-js'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''

const BIZ_TYPES = ['Restaurant', 'Food Truck', 'Pop-up', 'Ghost Kitchen']
const CUISINES = ['Mexican', 'Italian', 'American', 'Asian', 'Coffee', 'Pizza', 'BBQ', 'Sushi', 'Thai', 'Other']
const DURATIONS = ['30 min', '1 hour', '2 hours', '4 hours', 'All day']
const MAX_SPINS = ['50', '100', '200', '500', 'Unlimited']
const PRIZE_TYPES = ['Free item', 'Percentage off', 'Fixed discount', 'Free upgrade']

interface Prize {
  name: string
  type: string
  value: string
  couponType: 'flash' | 'long-term'
}

export default function BusinessSetupPage() {
  const { isSignedIn } = useUser()
  const [step, setStep] = useState(1)

  // Step 1
  const [bizName, setBizName] = useState('')
  const [bizType, setBizType] = useState(BIZ_TYPES[0])
  const [cuisine, setCuisine] = useState(CUISINES[0])

  // Step 2
  const [saleName, setSaleName] = useState('')
  const [duration, setDuration] = useState(DURATIONS[1])
  const [maxSpins, setMaxSpins] = useState(MAX_SPINS[1])

  // Step 3
  const [prizes, setPrizes] = useState<Prize[]>([
    { name: '', type: PRIZE_TYPES[0], value: '', couponType: 'flash' },
  ])

  const [showAuthModal, setShowAuthModal] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<'unverified' | 'pending' | 'verified' | 'rejected'>('unverified')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const addPrize = () => {
    if (prizes.length >= 5) return
    setPrizes([...prizes, { name: '', type: PRIZE_TYPES[0], value: '', couponType: 'flash' }])
  }

  const updatePrize = (i: number, field: keyof Prize, val: string) => {
    const updated = [...prizes]
    updated[i] = { ...updated[i], [field]: val }
    setPrizes(updated)
  }

  const removePrize = (i: number) => {
    if (prizes.length <= 1) return
    setPrizes(prizes.filter((_, idx) => idx !== i))
  }

  const validPrizes = prizes.filter((p) => p.name && p.value)
  const estimatedCost = maxSpins === 'Unlimited' ? '—' : `$${(Number(maxSpins) * 1.5).toFixed(0)} max`

  const handleAction = () => {
    if (!isSignedIn) {
      setShowAuthModal(true)
      return
    }
    // Would save to API — for now redirect
    window.location.href = '/dashboard'
  }

  // Mini wheel SVG for preview
  const previewPrizes = validPrizes.length > 0 ? validPrizes.map((p) => p.name) : ['Add prizes...']
  const segCount = Math.max(previewPrizes.length, 4)

  return (
    <main className="min-h-screen bg-night px-6 py-12">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/business" className="text-btc text-sm hover:underline">&larr; Back</Link>
          <span className="text-surface/30 text-sm">Step {step} of 4</span>
        </div>

        <h1 className="text-2xl font-bold text-surface mb-6">
          {step === 1 ? 'Your Business' : step === 2 ? 'Flash Sale Details' : step === 3 ? 'Add Prizes' : 'Preview & Launch'}
        </h1>

        {/* ─── Step 1: Business Info ─── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-surface/50 text-sm block mb-1">Business name</label>
              <input value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="Fuego Tacos"
                className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none" />
            </div>
            <div>
              <label className="text-surface/50 text-sm block mb-1">Type</label>
              <select value={bizType} onChange={(e) => setBizType(e.target.value)}
                className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none">
                {BIZ_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-surface/50 text-sm block mb-1">Cuisine</label>
              <select value={cuisine} onChange={(e) => setCuisine(e.target.value)}
                className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none">
                {CUISINES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button onClick={() => setStep(2)} disabled={!bizName}
              className="w-full bg-btc text-night font-bold py-3 rounded-xl mt-4 hover:bg-btc-dark transition disabled:opacity-40">
              Next
            </button>
          </div>
        )}

        {/* ─── Step 2: Sale Details ─── */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-surface/50 text-sm block mb-1">Sale name</label>
              <input value={saleName} onChange={(e) => setSaleName(e.target.value)} placeholder="Friday Lunch Rush"
                className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none" />
            </div>
            <div>
              <label className="text-surface/50 text-sm block mb-1">Duration</label>
              <select value={duration} onChange={(e) => setDuration(e.target.value)}
                className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none">
                {DURATIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-surface/50 text-sm block mb-1">Max spins</label>
              <select value={maxSpins} onChange={(e) => setMaxSpins(e.target.value)}
                className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none">
                {MAX_SPINS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(1)} className="flex-1 border border-surface/20 text-surface/60 py-3 rounded-xl font-bold">Back</button>
              <button onClick={() => setStep(3)} className="flex-1 bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition">Next</button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Prizes ─── */}
        {step === 3 && (
          <div className="space-y-4">
            {prizes.map((prize, i) => (
              <div key={i} className="bg-[#1a1230] rounded-xl p-4 space-y-3" style={{ border: '1px solid rgba(247,148,29,0.1)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-btc text-sm font-bold">Prize {i + 1}</span>
                  {prizes.length > 1 && (
                    <button onClick={() => removePrize(i)} className="text-red-400 text-xs hover:underline">Remove</button>
                  )}
                </div>
                <input value={prize.name} onChange={(e) => updatePrize(i, 'name', e.target.value)} placeholder="Free Taco"
                  className="w-full bg-night text-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-btc focus:outline-none" />
                <div className="flex gap-2">
                  <select value={prize.type} onChange={(e) => updatePrize(i, 'type', e.target.value)}
                    className="flex-1 bg-night text-surface border border-white/10 rounded-lg px-3 py-2 text-sm">
                    {PRIZE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input value={prize.value} onChange={(e) => updatePrize(i, 'value', e.target.value)} placeholder="$5 / 20%"
                    className="w-24 bg-night text-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-btc focus:outline-none" />
                </div>
                <div className="flex gap-2">
                  {(['flash', 'long-term'] as const).map((ct) => (
                    <button key={ct} onClick={() => updatePrize(i, 'couponType', ct)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${prize.couponType === ct ? 'bg-btc text-night' : 'bg-night text-surface/40 border border-white/10'}`}>
                      {ct === 'flash' ? 'Flash (expires with sale)' : 'Long-term (1 year)'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {prizes.length < 5 && (
              <button onClick={addPrize} className="w-full border border-btc/30 border-dashed text-btc text-sm font-bold py-3 rounded-xl hover:border-btc transition">
                + Add Prize
              </button>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(2)} className="flex-1 border border-surface/20 text-surface/60 py-3 rounded-xl font-bold">Back</button>
              <button onClick={() => setStep(4)} className="flex-1 bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition">Preview</button>
            </div>
          </div>
        )}

        {/* ─── Step 4: Preview ─── */}
        {step === 4 && (
          <div className="space-y-6">
            {/* Preview card */}
            <div className="bg-[#1a1230] rounded-2xl p-6 text-center" style={{ border: '1px solid rgba(247,148,29,0.15)' }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 font-black text-night text-2xl" style={{ background: '#F7941D' }}>
                {(bizName || '?')[0].toUpperCase()}
              </div>
              <h3 className="text-xl font-bold text-surface">{bizName || 'Your Business'}</h3>
              <p className="text-surface/40 text-sm">{saleName || 'Flash Sale'} • {duration}</p>
              <p className="text-surface/30 text-xs mt-1">{cuisine} {bizType}</p>

              {/* Mini wheel preview */}
              <div className="flex justify-center my-6">
                <svg viewBox="0 0 160 160" width="160" height="160">
                  <circle cx="80" cy="80" r="75" fill="none" stroke="#D4AF37" strokeWidth="2" />
                  {previewPrizes.map((label, i) => {
                    const seg = 360 / Math.max(previewPrizes.length, 3)
                    const a1 = i * seg, a2 = a1 + seg
                    const r1 = ((a1 - 90) * Math.PI) / 180, r2 = ((a2 - 90) * Math.PI) / 180
                    const mid = ((a1 + seg / 2 - 90) * Math.PI) / 180
                    return (
                      <g key={i}>
                        <path d={`M80,80 L${80 + 70 * Math.cos(r1)},${80 + 70 * Math.sin(r1)} A70,70 0 0 1 ${80 + 70 * Math.cos(r2)},${80 + 70 * Math.sin(r2)} Z`}
                          fill={i % 2 === 0 ? '#F7941D' : '#1a0e00'} stroke="#2a1400" strokeWidth="0.5" />
                        <text x={80 + 42 * Math.cos(mid)} y={80 + 42 * Math.sin(mid)} fill={i % 2 === 0 ? '#1a0e00' : '#F7941D'}
                          fontSize="7" fontWeight="bold" textAnchor="middle" dominantBaseline="central"
                          transform={`rotate(${a1 + seg / 2},${80 + 42 * Math.cos(mid)},${80 + 42 * Math.sin(mid)})`}>
                          {label.slice(0, 10)}
                        </text>
                      </g>
                    )
                  })}
                  <circle cx="80" cy="80" r="12" fill="#1a0e00" stroke="#D4AF37" strokeWidth="2" />
                  <text x="80" y="80" fill="#F7941D" fontSize="12" fontWeight="900" textAnchor="middle" dominantBaseline="central">S</text>
                </svg>
              </div>

              <div className="text-surface/40 text-sm">
                <span className="text-btc font-bold">{maxSpins}</span> spins • Estimated cost: <span className="text-btc font-bold">{estimatedCost}</span>
              </div>
              <p className="text-surface/30 text-xs mt-1">At $1.50/visit with {maxSpins} spins</p>
            </div>

            {/* Verification */}
            {isSignedIn && (
              <div className="bg-[#1a1230] rounded-2xl p-5" style={{ border: '1px solid rgba(247,148,29,0.1)' }}>
                <h4 className="text-surface font-bold mb-1">Verify Your Identity</h4>
                <p className="text-surface/40 text-sm mb-3">
                  We verify business owners to protect our community. Takes 2 minutes.
                </p>
                <div className="flex items-center gap-2 text-surface/30 text-xs mb-4">
                  <span>📋 Government ID</span>
                  <span>+</span>
                  <span>🤳 Selfie</span>
                  <span className="ml-auto text-teal">Free — covered by SerendipEatery</span>
                </div>

                {verifyStatus === 'unverified' && (
                  <button
                    onClick={async () => {
                      setVerifyLoading(true)
                      setVerifyError(null)
                      try {
                        const res = await fetch(`${API_URL}/businesses/verify/start`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ businessId: 'pending' }),
                        })
                        const data = await res.json()
                        if (data.ok && data.data.clientSecret) {
                          const stripeJs = await loadStripe(STRIPE_PK)
                          if (stripeJs) {
                            await (stripeJs as any).verifyIdentity(data.data.clientSecret)
                          }
                          setVerifyStatus('pending')
                          // Poll for status
                          pollRef.current = setInterval(async () => {
                            try {
                              const s = await fetch(`${API_URL}/businesses/verify/status?businessId=pending`)
                              const sd = await s.json()
                              if (sd.ok && sd.data.verification_status === 'verified') {
                                setVerifyStatus('verified')
                                if (pollRef.current) clearInterval(pollRef.current)
                              } else if (sd.ok && sd.data.verification_status === 'rejected') {
                                setVerifyStatus('rejected')
                                setVerifyError(sd.data.rejection_reason)
                                if (pollRef.current) clearInterval(pollRef.current)
                              }
                            } catch {}
                          }, 3000)
                        }
                      } catch {
                        setVerifyError('Failed to start verification')
                      }
                      setVerifyLoading(false)
                    }}
                    disabled={verifyLoading}
                    className="w-full bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition disabled:opacity-50"
                  >
                    {verifyLoading ? 'Starting...' : 'Start Verification'}
                  </button>
                )}

                {verifyStatus === 'pending' && (
                  <div className="flex items-center gap-2 text-btc">
                    <span className="animate-spin">⏳</span>
                    <span className="font-bold text-sm">Verification in progress...</span>
                  </div>
                )}

                {verifyStatus === 'verified' && (
                  <div className="flex items-center gap-2 text-teal">
                    <span>✅</span>
                    <span className="font-bold text-sm">Verified — you're good to go!</span>
                  </div>
                )}

                {verifyStatus === 'rejected' && (
                  <div>
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                      <span>❌</span>
                      <span className="font-bold text-sm">Verification failed</span>
                    </div>
                    {verifyError && <p className="text-surface/40 text-xs">{verifyError}</p>}
                    <button onClick={() => setVerifyStatus('unverified')}
                      className="mt-2 text-btc text-xs hover:underline">Try again</button>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 border border-surface/20 text-surface/60 py-3 rounded-xl font-bold">Back</button>
              {isSignedIn ? (
                <button
                  onClick={handleAction}
                  disabled={verifyStatus !== 'verified'}
                  className="flex-1 bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {verifyStatus === 'verified' ? 'Go Live' : 'Verify to Go Live'}
                </button>
              ) : (
                <SignInButton mode="modal">
                  <button className="flex-1 bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition">Sign Up to Go Live</button>
                </SignInButton>
              )}
            </div>
          </div>
        )}

        {/* Step dots */}
        <div className="flex justify-center gap-2 mt-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="w-2 h-2 rounded-full" style={{ background: s === step ? '#F7941D' : 'rgba(255,248,242,0.15)' }} />
          ))}
        </div>
      </div>
    </main>
  )
}
