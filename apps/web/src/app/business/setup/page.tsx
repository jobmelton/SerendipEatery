'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useUser, SignInButton } from '@clerk/nextjs'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const BIZ_TYPES = ['Restaurant', 'Food Truck', 'Pop-up', 'Ghost Kitchen']
const CUISINES = ['Mexican', 'Italian', 'American', 'Asian', 'Coffee', 'Pizza', 'BBQ', 'Sushi', 'Thai', 'Other']
const PRIZE_TYPES = ['Free item', 'Percentage off', 'Fixed discount', 'Free upgrade']
const REPEAT_OPTIONS = ['One time', 'Daily', 'Weekdays', 'Weekends', 'Weekly']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const COST_PER_VISIT = 1.50

// Generate 30-min time slots
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return { value: `${String(h).padStart(2, '0')}:${m}`, label: `${h12}:${m} ${ampm}` }
})

interface Prize {
  name: string
  type: string
  value: string
  couponType: 'flash' | 'long-term'
  probability: number // 5-95, increments of 5
}

export default function BusinessSetupPage() {
  const { isSignedIn } = useUser()
  const [step, setStep] = useState(1)

  // Step 1
  const [bizName, setBizName] = useState('')
  const [bizType, setBizType] = useState(BIZ_TYPES[0])
  const [cuisine, setCuisine] = useState(CUISINES[0])

  // Step 2: Schedule & ROI
  const [saleName, setSaleName] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('11:30')
  const [endTime, setEndTime] = useState('14:00')
  const [repeatMode, setRepeatMode] = useState('One time')
  const [weeklyDays, setWeeklyDays] = useState<string[]>([])
  const [expectedCustomers, setExpectedCustomers] = useState('50')
  const [avgSpend, setAvgSpend] = useState('15')

  // Step 3
  const [prizes, setPrizes] = useState<Prize[]>([
    { name: '', type: PRIZE_TYPES[0], value: '', couponType: 'flash', probability: 15 },
  ])
  const [confirmNoTryAgain, setConfirmNoTryAgain] = useState(false)

  const [showAuthModal, setShowAuthModal] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<'unverified' | 'pending' | 'verified' | 'rejected'>('unverified')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [idDoc, setIdDoc] = useState<File | null>(null)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeLiability, setAgreeLiability] = useState(false)
  const [showPlanAgreement, setShowPlanAgreement] = useState<'growth' | 'pro' | null>(null)
  const [planAgreeCommit, setPlanAgreeCommit] = useState(false)
  const [planAgreeETF, setPlanAgreeETF] = useState(false)

  // Probability helpers
  const assignedTotal = prizes.reduce((s, p) => s + p.probability, 0)
  const tryAgainPct = Math.max(0, 100 - assignedTotal)

  const addPrize = () => {
    if (prizes.length >= 19) return // max 19 + Try Again = 20
    const remaining = 100 - assignedTotal
    const newProb = Math.min(Math.max(5, remaining - 5), 95) // leave room for Try Again
    if (assignedTotal + 5 > 100) return // can't add if no room
    setPrizes([...prizes, { name: '', type: PRIZE_TYPES[0], value: '', couponType: 'flash', probability: Math.min(newProb, 5) > 0 ? 5 : 5 }])
  }

  const adjustProbability = (i: number, delta: number) => {
    const updated = [...prizes]
    const newVal = updated[i].probability + delta
    if (newVal < 5 || newVal > 95) return
    const newTotal = assignedTotal + delta
    if (newTotal > 100) return // would exceed 100%
    updated[i] = { ...updated[i], probability: newVal }
    setPrizes(updated)
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

  // Schedule calculations
  const startIdx = TIME_SLOTS.findIndex((t) => t.value === startTime)
  const endIdx = TIME_SLOTS.findIndex((t) => t.value === endTime)
  const durationMins = endIdx > startIdx ? (endIdx - startIdx) * 30 : 0
  const durationLabel = durationMins > 0
    ? `${Math.floor(durationMins / 60)}h${durationMins % 60 > 0 ? ` ${durationMins % 60}m` : ''}`
    : ''
  const startLabel = TIME_SLOTS.find((t) => t.value === startTime)?.label ?? ''
  const endLabel = TIME_SLOTS.find((t) => t.value === endTime)?.label ?? ''
  const dateObj = new Date(startDate + 'T12:00:00')
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' })

  // ROI calculations
  const custNum = Number(expectedCustomers) || 0
  const maxCost = custNum * COST_PER_VISIT
  const avgSpendNum = Number(avgSpend) || 0
  const revenuePotential = custNum * avgSpendNum
  const roi = maxCost > 0 ? revenuePotential / maxCost : 0

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
          {step === 1 ? 'Your Business' : step === 2 ? 'Schedule Your Sale' : step === 3 ? 'Add Prizes' : 'Preview & Launch'}
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

        {/* ─── Step 2: Schedule & ROI ─── */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Sale Name */}
            <div>
              <label className="text-surface/50 text-sm block mb-1">Sale name</label>
              <input value={saleName} onChange={(e) => setSaleName(e.target.value)} placeholder="Friday Lunch Rush"
                className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none" />
            </div>

            {/* Schedule */}
            <div>
              <label className="text-surface/50 text-sm block mb-1">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-surface/50 text-sm block mb-1">Start time</label>
                <select value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm">
                  {TIME_SLOTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-surface/50 text-sm block mb-1">End time</label>
                <select value={endTime} onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm">
                  {TIME_SLOTS.filter((t) => t.value > startTime).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            {durationMins > 0 && (
              <p className="text-surface/30 text-xs">This sale runs for {durationLabel}</p>
            )}

            {/* Repeat */}
            <div>
              <label className="text-surface/50 text-sm block mb-2">Repeat</label>
              <div className="flex flex-wrap gap-2">
                {REPEAT_OPTIONS.map((r) => (
                  <button key={r} onClick={() => { setRepeatMode(r); if (r !== 'Weekly') setWeeklyDays([]) }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${repeatMode === r ? 'bg-btc text-night' : 'bg-white/5 text-surface/40 border border-white/10'}`}>
                    {r}
                  </button>
                ))}
              </div>
              {repeatMode === 'Weekly' && (
                <div className="flex gap-2 mt-2">
                  {DAYS.map((d) => (
                    <button key={d} onClick={() => setWeeklyDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])}
                      className={`w-10 h-10 rounded-lg text-xs font-bold transition ${weeklyDays.includes(d) ? 'bg-btc text-night' : 'bg-white/5 text-surface/40 border border-white/10'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Preview */}
            {durationMins > 0 && (
              <div className="bg-[#1a1230] rounded-xl p-3 text-sm text-surface/60">
                Your sale will be live <span className="text-surface font-bold">{dayName} {startLabel} – {endLabel}</span>
                {repeatMode !== 'One time' && <span className="text-btc"> ({repeatMode})</span>}
              </div>
            )}

            {/* Expected Customers */}
            <div>
              <label className="text-surface/50 text-sm block mb-1">Expected customers</label>
              <input type="number" value={expectedCustomers} onChange={(e) => setExpectedCustomers(e.target.value)} placeholder="50" min="1"
                className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none" />
              <p className="text-surface/20 text-xs mt-1">
                We charge ${COST_PER_VISIT.toFixed(2)} per verified visit. {custNum} customers = max ${maxCost.toFixed(2)} campaign cost.
                You only pay when someone spins AND walks into your location.
              </p>
              <p className="text-surface/30 text-xs mt-0.5">
                Cost per visit: <span className="text-btc font-bold">${COST_PER_VISIT.toFixed(2)}</span> — Growth plan
              </p>
            </div>

            {/* ROI Calculator */}
            <div className="bg-[#1a1230] rounded-2xl p-5" style={{ border: '1px solid rgba(247,148,29,0.1)' }}>
              <h4 className="text-surface font-bold mb-3 flex items-center gap-2">📊 Your ROI Estimate</h4>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between"><span className="text-surface/40">Expected customers</span><span className="text-surface">{custNum}</span></div>
                <div className="flex justify-between"><span className="text-surface/40">Cost per visit</span><span className="text-surface">${COST_PER_VISIT.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-white/5 pt-2"><span className="text-surface/40">Max campaign cost</span><span className="text-btc font-bold">${maxCost.toFixed(2)}</span></div>
              </div>

              <div>
                <label className="text-surface/40 text-xs block mb-1">Average spend per customer</label>
                <div className="flex items-center gap-2">
                  <span className="text-surface/30">$</span>
                  <input type="number" value={avgSpend} onChange={(e) => setAvgSpend(e.target.value)} placeholder="15" min="1"
                    className="w-24 bg-night text-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-btc focus:outline-none" />
                  <span className="text-surface/20 text-xs">(your typical check)</span>
                </div>
              </div>

              {avgSpendNum > 0 && custNum > 0 && (
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-surface/40">Revenue potential</span><span className="text-surface">${revenuePotential.toLocaleString()}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-surface/40">ROI</span>
                    <span className="text-btc font-black text-2xl">{roi.toFixed(0)}x</span>
                  </div>
                  {roi > 5 && <p className="text-teal text-xs font-bold">🟢 Great ROI potential!</p>}
                  {roi >= 2 && roi <= 5 && <p className="text-surface/40 text-xs">Solid return on investment</p>}
                  {roi > 0 && roi < 2 && <p className="text-yellow-400 text-xs">⚠️ Low ROI — consider increasing average spend or reducing prizes</p>}
                </div>
              )}

              <p className="text-surface/20 text-xs mt-3">You only pay for confirmed visits — customers who physically walked in</p>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(1)} className="flex-1 border border-surface/20 text-surface/60 py-3 rounded-xl font-bold">Back</button>
              <button onClick={() => setStep(3)} disabled={!saleName || durationMins <= 0}
                className="flex-1 bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition disabled:opacity-40">Next</button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Prizes with Probability ─── */}
        {step === 3 && (
          <div className="space-y-4">
            {prizes.map((prize, i) => (
              <div key={i} className="bg-[#1a1230] rounded-xl p-4 space-y-3" style={{ border: '1px solid rgba(247,148,29,0.1)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-btc text-sm font-bold">Prize {i + 1}</span>
                  <button onClick={() => removePrize(i)} className="text-red-400 text-xs hover:underline">Remove</button>
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
                {/* Probability control */}
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-surface/40 text-xs">Chance:</span>
                  <button
                    onClick={() => adjustProbability(i, -5)}
                    disabled={prize.probability <= 5}
                    className="w-8 h-8 rounded-lg bg-night border border-white/10 text-surface/50 font-bold text-sm disabled:opacity-20"
                  >−</button>
                  <span className="text-btc font-bold text-sm w-12 text-center">{prize.probability}%</span>
                  <button
                    onClick={() => adjustProbability(i, 5)}
                    disabled={prize.probability >= 95 || assignedTotal >= 100}
                    className="w-8 h-8 rounded-lg bg-night border border-white/10 text-surface/50 font-bold text-sm disabled:opacity-20"
                  >+</button>
                </div>
              </div>
            ))}

            {/* Try Again (auto-filled) */}
            <div className="bg-[#1a1230] rounded-xl p-4" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between">
                <span className="text-surface/40 text-sm font-bold">Try Again</span>
                <span className="text-surface/30 text-xs">Cannot be removed</span>
              </div>
              <p className="text-surface/30 text-xs mt-1">
                {tryAgainPct > 0 ? `${tryAgainPct}% (auto-filled remainder)` : 'Removed — 0%'}
              </p>
            </div>

            {/* Probability total */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-surface/40">Total assigned: {assignedTotal}%</span>
                <span className="text-surface/30">Try Again: {tryAgainPct}%</span>
              </div>
              <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${Math.min(assignedTotal, 100)}%`,
                  background: assignedTotal > 100 ? '#E53E3E' : '#F7941D',
                }} />
              </div>
              {assignedTotal > 100 && (
                <p className="text-red-400 text-xs font-bold">Over 100% — reduce prize chances</p>
              )}
              {assignedTotal <= 100 && tryAgainPct > 0 && (
                <div className="flex items-center gap-1 text-teal text-xs">
                  <span>✅</span>
                  <span>100% assigned ({tryAgainPct}% Try Again)</span>
                </div>
              )}
              {tryAgainPct === 0 && assignedTotal === 100 && !confirmNoTryAgain && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-xs">
                  <p className="text-yellow-400 font-bold mb-2">Try Again removed — are you sure?</p>
                  <p className="text-surface/40 mb-2">Players always expect a chance to spin again.</p>
                  <button onClick={() => setConfirmNoTryAgain(true)} className="text-btc font-bold hover:underline">Yes, I'm sure</button>
                </div>
              )}
              {tryAgainPct === 0 && confirmNoTryAgain && (
                <p className="text-yellow-400 text-xs">⚠️ No Try Again — every spin wins a prize</p>
              )}
            </div>

            {assignedTotal < 100 && (
              <button onClick={addPrize} className="w-full border border-btc/30 border-dashed text-btc text-sm font-bold py-3 rounded-xl hover:border-btc transition">
                + Add Prize ({100 - assignedTotal}% remaining)
              </button>
            )}

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(2)} className="flex-1 border border-surface/20 text-surface/60 py-3 rounded-xl font-bold">Back</button>
              <button
                onClick={() => setStep(4)}
                disabled={assignedTotal > 100 || (tryAgainPct === 0 && !confirmNoTryAgain)}
                className="flex-1 bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition disabled:opacity-40"
              >Preview</button>
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
              <p className="text-surface/40 text-sm">{saleName || 'Flash Sale'} • {durationLabel}</p>
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
                <span className="text-btc font-bold">{custNum}</span> customers • Max cost: <span className="text-btc font-bold">${maxCost.toFixed(2)}</span>
                {roi > 0 && <> • ROI: <span className="text-btc font-bold">{roi.toFixed(0)}x</span></>}
              </div>
              <p className="text-surface/30 text-xs mt-1">{dayName} {startLabel} – {endLabel}{repeatMode !== 'One time' ? ` (${repeatMode})` : ''}</p>
            </div>

            {/* Self-Attestation Verification */}
            {isSignedIn && verifyStatus !== 'verified' && (
              <div className="bg-[#1a1230] rounded-2xl p-5 space-y-4" style={{ border: '1px solid rgba(247,148,29,0.1)' }}>
                <h4 className="text-surface font-bold">Verify Your Identity</h4>
                <p className="text-surface/40 text-sm">We verify business owners to protect our community. Takes 2 minutes.</p>

                {/* Photo ID */}
                <div>
                  <label className="text-surface/50 text-xs block mb-1">📋 Government-issued ID (Driver's License, Passport, or State ID)</label>
                  <input type="file" accept="image/*,.pdf" onChange={(e) => setIdDoc(e.target.files?.[0] ?? null)}
                    className="w-full bg-night text-surface/60 border border-white/10 rounded-lg px-3 py-2 text-xs file:mr-3 file:bg-btc file:text-night file:border-0 file:rounded file:px-3 file:py-1 file:text-xs file:font-bold" />
                  {idDoc && <p className="text-teal text-xs mt-1">✓ {idDoc.name}</p>}
                </div>

                {/* Selfie */}
                <div>
                  <label className="text-surface/50 text-xs block mb-1">🤳 Selfie holding your ID (both face and ID visible)</label>
                  <input type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
                    className="w-full bg-night text-surface/60 border border-white/10 rounded-lg px-3 py-2 text-xs file:mr-3 file:bg-btc file:text-night file:border-0 file:rounded file:px-3 file:py-1 file:text-xs file:font-bold" />
                  {selfie && <p className="text-teal text-xs mt-1">✓ {selfie.name}</p>}
                </div>

                {/* Legal Agreement */}
                <div className="bg-night rounded-xl p-3 max-h-40 overflow-y-auto text-surface/30 text-[10px] leading-relaxed">
                  <p className="font-bold text-surface/50 mb-2">SERENDIPEATERY BUSINESS VERIFICATION AGREEMENT</p>
                  <p className="mb-2">By checking the box below and submitting your verification, you confirm under penalty of civil liability that:</p>
                  <p className="mb-1">1. IDENTITY: You are the person depicted in the uploaded selfie and government ID.</p>
                  <p className="mb-1">2. BUSINESS AUTHORITY: You are the owner, operator, or authorized representative of the business you are registering.</p>
                  <p className="mb-1">3. BUSINESS LEGITIMACY: The business you are registering is a real, operating food service business.</p>
                  <p className="mb-1">4. NO GAMING: You will not use this account to fraudulently earn points, manipulate referrals, or game any aspect of the platform.</p>
                  <p className="mb-1">5. REPUTATIONAL HARM: Fraudulent use may result in liability for damages up to $50,000 per fraudulent act.</p>
                  <p className="mb-1">6. ACCURATE INFORMATION: All information provided is true and accurate.</p>
                  <p>7. ONGOING COMPLIANCE: You agree to maintain these standards. SerendipEatery reserves the right to terminate any account found in violation.</p>
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-0.5 accent-btc" />
                  <span className="text-surface/60 text-xs">I have read, understood, and agree to the Business Verification Agreement. All information I have provided is truthful.</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={agreeLiability} onChange={(e) => setAgreeLiability(e.target.checked)} className="mt-0.5 accent-btc" />
                  <span className="text-surface/60 text-xs">I understand that misrepresentation may result in civil liability and account termination.</span>
                </label>

                <button
                  onClick={async () => {
                    setVerifyLoading(true)
                    setVerifyError(null)
                    try {
                      // In production: upload files to Supabase Storage first
                      // For now: submit with placeholder URLs
                      const res = await fetch(`${API_URL}/businesses/verify/submit`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          businessId: 'pending',
                          idDocumentUrl: idDoc ? `uploaded/${idDoc.name}` : '',
                          selfieUrl: selfie ? `uploaded/${selfie.name}` : '',
                        }),
                      })
                      const data = await res.json()
                      if (data.ok) setVerifyStatus('verified')
                      else setVerifyError(data.error ?? 'Verification failed')
                    } catch {
                      setVerifyError('Failed to submit verification')
                    }
                    setVerifyLoading(false)
                  }}
                  disabled={!idDoc || !selfie || !agreeTerms || !agreeLiability || verifyLoading}
                  className="w-full bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {verifyLoading ? 'Submitting...' : 'Submit Verification'}
                </button>
                {verifyError && <p className="text-red-400 text-xs">{verifyError}</p>}
              </div>
            )}

            {verifyStatus === 'verified' && (
              <div className="flex items-center gap-2 text-teal bg-teal/10 rounded-xl p-3">
                <span>✅</span>
                <span className="font-bold text-sm">Verified — you're good to go!</span>
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

      {/* ─── Plan Agreement Modal ─── */}
      {showPlanAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => { setShowPlanAgreement(null); setPlanAgreeCommit(false); setPlanAgreeETF(false) }} />
          <div className="relative rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ background: '#1a1230' }}>
            <h2 className="text-xl font-bold text-surface mb-4">
              {showPlanAgreement === 'pro' ? '5-Year Pro Commitment' : '1-Year Growth Commitment'}
            </h2>

            <div className="rounded-xl p-4 mb-4 text-xs text-surface/60 leading-relaxed max-h-64 overflow-y-auto" style={{ background: '#0f0a1e', border: '1px solid rgba(255,255,255,0.1)' }}>
              {showPlanAgreement === 'pro' ? (
                <>
                  <p className="font-bold text-surface/80 mb-2">PRO PLAN SERVICE AGREEMENT</p>
                  <p className="mb-2">By subscribing to the SerendipEatery Pro Plan, you agree to the following terms:</p>
                  <p className="mb-2"><strong>COMMITMENT PERIOD:</strong> You are committing to a 5-year (60-month) subscription at $99 per month, totaling $5,940 over the commitment period.</p>
                  <p className="mb-2"><strong>MONTHLY BILLING:</strong> Your card will be charged $99 on the same date each month. Payments are non-refundable.</p>
                  <p className="mb-2"><strong>RATE LOCK GUARANTEE:</strong> SerendipEatery guarantees your rate will not exceed $99/month for the full 60-month commitment period, regardless of future price increases.</p>
                  <p className="mb-2"><strong>EARLY TERMINATION:</strong> If you choose to cancel your Pro subscription before the 60-month commitment period ends, you agree to pay an early termination fee equal to the remaining monthly payments due.</p>
                  <p className="mb-2">Early termination fee formula: Remaining months × $99 = Amount due immediately upon cancellation</p>
                  <p className="mb-2">Example: If you cancel after 18 months, you owe 42 × $99 = $4,158.</p>
                  <p className="mb-2"><strong>AUTOMATIC RENEWAL:</strong> After the initial 60-month period, your subscription converts to month-to-month at the then-current Pro rate unless cancelled with 30 days notice.</p>
                  <p className="mb-2"><strong>UNLIMITED VISITS:</strong> Pro plan includes unlimited confirmed visits with no monthly caps and no shadow mode activation.</p>
                  <p>By checking the boxes below and completing checkout, you create a legally binding service agreement.</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-surface/80 mb-2">GROWTH PLAN SERVICE AGREEMENT</p>
                  <p className="mb-2"><strong>COMMITMENT PERIOD:</strong> You are committing to a 1-year (12-month) subscription at $79 per month.</p>
                  <p className="mb-2"><strong>MONTHLY BILLING:</strong> Your card will be charged $79 on the same date each month.</p>
                  <p className="mb-2"><strong>EARLY TERMINATION:</strong> If you cancel before 12 months, you owe remaining months × $79 immediately.</p>
                  <p className="mb-2"><strong>AFTER 12 MONTHS:</strong> Your plan converts to month-to-month at $79/mo. Cancel anytime with 30 days notice.</p>
                  <p>By checking the boxes below and completing checkout, you create a legally binding service agreement.</p>
                </>
              )}
            </div>

            <div className="space-y-3 mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={planAgreeCommit} onChange={(e) => setPlanAgreeCommit(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-white/20 accent-btc" />
                <span className="text-surface/70 text-sm">
                  {showPlanAgreement === 'pro'
                    ? 'I agree to a 60-month (5-year) commitment at $99/month'
                    : 'I agree to a 12-month commitment at $79/month'}
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={planAgreeETF} onChange={(e) => setPlanAgreeETF(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-white/20 accent-btc" />
                <span className="text-surface/70 text-sm">
                  {showPlanAgreement === 'pro'
                    ? 'I understand the early termination fee equals remaining months × $99 and is due immediately upon cancellation'
                    : 'I understand early termination fee = remaining months × $79'}
                </span>
              </label>
            </div>

            <button
              disabled={!planAgreeCommit || !planAgreeETF}
              onClick={() => {
                setShowPlanAgreement(null)
                setPlanAgreeCommit(false)
                setPlanAgreeETF(false)
                // Redirect to Stripe checkout
                window.location.href = `/billing?plan=${showPlanAgreement}&agreed=true`
              }}
              className="w-full bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue to Payment
            </button>
            <button onClick={() => { setShowPlanAgreement(null); setPlanAgreeCommit(false); setPlanAgreeETF(false) }}
              className="w-full text-center text-surface/30 text-sm mt-3 hover:text-surface/50 transition">
              Go Back
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
