'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const BIZ_TYPES = ['Food Truck', 'Restaurant', 'Pop-up', 'Ghost Kitchen']
const CUISINES = ['Mexican', 'Italian', 'American', 'Asian', 'Coffee', 'Pizza', 'BBQ', 'Sushi', 'Thai', 'Other']
const DURATIONS = ['30 min', '1 hour', '2 hours', '4 hours', 'All day']
const REPEATS = ['Once', 'Daily', 'Weekdays', 'Weekly']
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2); const m = i % 2 === 0 ? '00' : '30'
  const ampm = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return { value: `${String(h).padStart(2, '0')}:${m}`, label: `${h12}:${m} ${ampm}` }
})

interface Prize {
  name: string; couponType: 'flash' | 'long_term' | 'high_value'; value: string
  probability: number; maxWinners: string; redeemWindow: number; dailyCap: string
}

// ─── Tooltip ─────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!show) return
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('[data-tip]')) setShow(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [show])
  return (
    <span className="relative inline-flex items-center ml-1" data-tip>
      <span onClick={(e) => { e.stopPropagation(); setShow(!show) }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full border border-[#a09080] text-[#a09080] text-[9px] font-semibold cursor-help shrink-0">?</span>
      {show && (
        <span className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-[#1a0e00] border border-[rgba(247,148,29,0.3)] text-[#fff8f2] text-[11px] px-2.5 py-1.5 rounded-md w-48 z-50 leading-snug pointer-events-none">
          {text}
        </span>
      )}
    </span>
  )
}

// ─── Pill Toggle ─────────────────────────────────────────────────────────

function Pills({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)}
          className={`px-4 py-2 rounded-full text-xs font-bold transition ${value === o ? 'bg-btc text-night' : 'bg-white/5 text-surface/40 border border-white/10 hover:text-surface/60'}`}>
          {o}
        </button>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────��──────

const TOTAL_STEPS = 6

export default function BusinessOnboardingPage() {
  const { isSignedIn } = useUser()
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState<'left' | 'right'>('right')
  const [animating, setAnimating] = useState(false)

  // Step 1: Business Info
  const [saleName, setSaleName] = useState('')
  const [bizType, setBizType] = useState(BIZ_TYPES[0])
  const [cuisine, setCuisine] = useState(CUISINES[0])

  // Step 2: Schedule
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('11:30')
  const [duration, setDuration] = useState('1 hour')
  const [repeat, setRepeat] = useState('Once')

  // Step 3 & 4: Prizes
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [showAddPrize, setShowAddPrize] = useState(false)
  const [newPrize, setNewPrize] = useState<Prize>({ name: '', couponType: 'flash', value: '', probability: 15, maxWinners: '', redeemWindow: 15, dailyCap: '' })

  // Step 5: ROI
  const [expectedCustomers, setExpectedCustomers] = useState('50')
  const [avgSpend, setAvgSpend] = useState('15')

  // Step 6: Live
  const [isLive, setIsLive] = useState(false)
  const [liveMetrics, setLiveMetrics] = useState({ notified: 0, spun: 0, claimed: 0, visited: 0 })

  // Prize calculations
  const assignedTotal = prizes.reduce((s, p) => s + p.probability, 0)
  const tryAgainPct = Math.max(0, 100 - assignedTotal)

  // ROI calculations
  const custNum = Number(expectedCustomers) || 0
  const avgCheck = Number(avgSpend) || 0
  const revenue = custNum * avgCheck
  const roi = custNum > 0 ? revenue / (custNum * 1.5) : 0

  // Schedule preview
  const startLabel = TIME_SLOTS.find(t => t.value === startTime)?.label ?? startTime
  const endMins = { '30 min': 30, '1 hour': 60, '2 hours': 120, '4 hours': 240, 'All day': 720 }[duration] ?? 60
  const endIdx = TIME_SLOTS.findIndex(t => t.value === startTime) + endMins / 30
  const endLabel = TIME_SLOTS[Math.min(endIdx, TIME_SLOTS.length - 1)]?.label ?? ''

  // Navigation
  const goTo = useCallback((target: number) => {
    if (target === step || animating) return
    setDirection(target > step ? 'right' : 'left')
    setAnimating(true)
    setTimeout(() => { setStep(target); setAnimating(false) }, 50)
  }, [step, animating])

  const next = () => { if (step < TOTAL_STEPS) goTo(step + 1) }
  const prev = () => { if (step > 1) goTo(step - 1) }

  // Save draft to localStorage
  useEffect(() => {
    const draft = { saleName, bizType, cuisine, startDate, startTime, duration, repeat, prizes, expectedCustomers, avgSpend }
    localStorage.setItem('se_biz_draft', JSON.stringify(draft))
  }, [saleName, bizType, cuisine, startDate, startTime, duration, repeat, prizes, expectedCustomers, avgSpend])

  // Load draft
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem('se_biz_draft') ?? '{}')
      if (d.saleName) setSaleName(d.saleName)
      if (d.bizType) setBizType(d.bizType)
      if (d.cuisine) setCuisine(d.cuisine)
      if (d.startDate) setStartDate(d.startDate)
      if (d.startTime) setStartTime(d.startTime)
      if (d.duration) setDuration(d.duration)
      if (d.repeat) setRepeat(d.repeat)
      if (d.prizes?.length) setPrizes(d.prizes)
      if (d.expectedCustomers) setExpectedCustomers(d.expectedCustomers)
      if (d.avgSpend) setAvgSpend(d.avgSpend)
    } catch {}
  }, [])

  // Add prize
  const addPrize = () => {
    if (!newPrize.name) return
    setPrizes([...prizes, { ...newPrize }])
    setNewPrize({ name: '', couponType: 'flash', value: '', probability: 15, maxWinners: '', redeemWindow: 15, dailyCap: '' })
    setShowAddPrize(false)
  }

  // Go Live
  const goLive = async () => {
    setIsLive(true)
    goTo(6)
    // POST to API would happen here
  }

  // Step validation
  const canProceed = (s: number) => {
    if (s === 1) return saleName.trim().length > 0
    if (s === 3) return prizes.length > 0
    if (s === 4) return assignedTotal <= 100
    return true
  }

  const slideClass = `transition-all duration-[350ms] ease-out ${animating ? (direction === 'right' ? 'translate-x-10 opacity-0' : '-translate-x-10 opacity-0') : 'translate-x-0 opacity-100'}`

  return (
    <main className="min-h-screen bg-night flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-3xl mx-auto w-full">
        <div className="flex items-baseline gap-0.5">
          <span className="font-display text-xl font-black text-btc">S</span>
          <span className="font-display text-xl font-black text-surface">erendip</span>
          <span className="font-display text-xl font-black text-btc/40">Eatery</span>
        </div>
        <Link href="/business/promotions" className="text-sm text-surface/40 hover:text-surface transition">
          Skip to Dashboard
        </Link>
      </header>

      {/* Step Content */}
      <div className="flex-1 px-6 pb-4 max-w-lg mx-auto w-full">
        <p className="text-surface/30 text-xs mb-4">Step {step} of {TOTAL_STEPS}</p>

        <div className={slideClass}>
          {/* ─── STEP 1: Business Info ─── */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-2xl font-black text-surface">Business Info</h2>
              <div>
                <label className="text-surface/50 text-xs font-bold flex items-center mb-1">Sale name <Tooltip text="The name customers will see when they get a flash sale notification" /></label>
                <input autoFocus value={saleName} onChange={e => setSaleName(e.target.value)} placeholder="Taco Tuesday Flash Sale"
                  className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none animate-[pulseOrange_2s_ease-in-out_1]" />
              </div>
              <div>
                <label className="text-surface/50 text-xs font-bold flex items-center mb-2">Business type <Tooltip text="Helps us show your business to the right customers nearby" /></label>
                <Pills options={BIZ_TYPES} value={bizType} onChange={setBizType} />
              </div>
              <div>
                <label className="text-surface/50 text-xs font-bold flex items-center mb-1">Cuisine <Tooltip text="Used to match hungry customers with your style of food" /></label>
                <select value={cuisine} onChange={e => setCuisine(e.target.value)}
                  className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none">
                  {CUISINES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* ─── STEP 2: Schedule ─── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-2xl font-black text-surface">Schedule</h2>
              <div>
                <label className="text-surface/50 text-xs font-bold mb-1 block">Start date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none" />
              </div>
              <div>
                <label className="text-surface/50 text-xs font-bold flex items-center mb-1">Start time <Tooltip text="Customers get notified the moment your sale goes live" /></label>
                <select value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none">
                  {TIME_SLOTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-surface/50 text-xs font-bold flex items-center mb-2">Duration <Tooltip text="Shorter sales create more urgency and higher spin rates" /></label>
                <Pills options={DURATIONS} value={duration} onChange={setDuration} />
              </div>
              <div>
                <label className="text-surface/50 text-xs font-bold flex items-center mb-2">Repeat <Tooltip text="Run the same sale automatically on selected days" /></label>
                <Pills options={REPEATS} value={repeat} onChange={setRepeat} />
              </div>
              <div className="rounded-xl p-3 text-sm text-btc/70" style={{ background: 'rgba(247,148,29,0.05)' }}>
                Your sale runs {startDate === new Date().toISOString().slice(0, 10) ? 'Today' : startDate} {startLabel} – {endLabel}
              </div>
            </div>
          )}

          {/* ─── STEP 3: Add Prizes ─── */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-black text-surface">Add Prizes</h2>
              {prizes.length < 5 && (
                <div className="rounded-xl p-3 text-xs text-btc/60" style={{ background: 'rgba(247,148,29,0.05)', border: '1px solid rgba(247,148,29,0.1)' }}>
                  We recommend 5+ prizes for the best customer experience
                </div>
              )}
              {prizes.map((p, i) => (
                <div key={i} className="bg-[#1a1230] rounded-xl p-4 flex items-start justify-between" style={{ border: '1px solid rgba(247,148,29,0.08)' }}>
                  <div>
                    <p className="text-surface font-bold text-sm">{p.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.couponType === 'high_value' ? 'bg-yellow-500/20 text-yellow-400' : p.couponType === 'long_term' ? 'bg-teal/20 text-teal' : 'bg-btc/20 text-btc'}`}>
                        {p.couponType === 'flash' ? 'Flash' : p.couponType === 'long_term' ? 'Long-term' : 'High Value'}
                      </span>
                      <span className="text-surface/30 text-xs">{p.probability}%</span>
                      {p.value && <span className="text-surface/30 text-xs">{p.value}</span>}
                    </div>
                  </div>
                  <button onClick={() => setPrizes(prizes.filter((_, j) => j !== i))} className="text-red-400/50 text-xs hover:text-red-400">Remove</button>
                </div>
              ))}
              {!showAddPrize ? (
                <button onClick={() => setShowAddPrize(true)} className="w-full border border-dashed border-btc/30 text-btc text-sm font-bold py-3 rounded-xl hover:bg-btc/5 transition">
                  + Add Prize
                </button>
              ) : (
                <div className="bg-[#1a1230] rounded-xl p-4 space-y-3" style={{ border: '1px solid rgba(247,148,29,0.15)' }}>
                  <input value={newPrize.name} onChange={e => setNewPrize({ ...newPrize, name: e.target.value })} placeholder="Free Taco" autoFocus
                    className="w-full bg-night text-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-btc focus:outline-none" />
                  <div>
                    <label className="text-surface/40 text-xs flex items-center mb-1">Type
                      <Tooltip text="Flash: expires with sale. Long-term: 1 year, lootable. High Value: never expires until redeemed." />
                    </label>
                    <Pills options={['flash', 'long_term', 'high_value']} value={newPrize.couponType}
                      onChange={v => setNewPrize({ ...newPrize, couponType: v as any })} />
                  </div>
                  <input value={newPrize.value} onChange={e => setNewPrize({ ...newPrize, value: e.target.value })} placeholder="$5 off / 20% off / Free item"
                    className="w-full bg-night text-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-btc focus:outline-none" />
                  {newPrize.couponType === 'high_value' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-surface/40 text-xs w-24 shrink-0">Redeem window:</span>
                        <select value={newPrize.redeemWindow} onChange={e => setNewPrize({ ...newPrize, redeemWindow: Number(e.target.value) })}
                          className="flex-1 bg-night text-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs">
                          <option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>60 min</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-surface/40 text-xs w-24 shrink-0 flex items-center">Daily cap <Tooltip text="Limits how many can be redeemed per day across all customers" /></span>
                        <input type="number" value={newPrize.dailyCap} onChange={e => setNewPrize({ ...newPrize, dailyCap: e.target.value })} placeholder="Unlimited" min="1"
                          className="flex-1 bg-night text-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:border-btc focus:outline-none" />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-surface/40 text-xs flex items-center">Chance <Tooltip text="Higher % = more customers win this. Lower % = rarer and more exciting." /></span>
                    <button onClick={() => setNewPrize({ ...newPrize, probability: Math.max(5, newPrize.probability - 5) })}
                      className="w-7 h-7 rounded-lg bg-night border border-white/10 text-surface/50 text-sm font-bold">−</button>
                    <span className="text-btc font-bold text-sm w-10 text-center">{newPrize.probability}%</span>
                    <button onClick={() => setNewPrize({ ...newPrize, probability: Math.min(95, newPrize.probability + 5) })}
                      className="w-7 h-7 rounded-lg bg-night border border-white/10 text-surface/50 text-sm font-bold">+</button>
                  </div>
                  <input value={newPrize.maxWinners} onChange={e => setNewPrize({ ...newPrize, maxWinners: e.target.value })} placeholder="Max winners (optional)" type="number" min="1"
                    className="w-full bg-night text-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-btc focus:outline-none" />
                  <div className="flex gap-2">
                    <button onClick={addPrize} disabled={!newPrize.name} className="flex-1 bg-btc text-night font-bold py-2 rounded-lg text-sm disabled:opacity-40">Add</button>
                    <button onClick={() => setShowAddPrize(false)} className="flex-1 border border-white/10 text-surface/40 font-bold py-2 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              )}
              <p className="text-surface/30 text-xs">{assignedTotal}% assigned · Try Again: {tryAgainPct}% (auto)</p>
            </div>
          )}

          {/* ─── STEP 4: Win Chances ─── */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-black text-surface">Win Chances</h2>
              {prizes.length === 0 && <p className="text-surface/40 text-sm">Add prizes in the previous step first</p>}
              {prizes.map((p, i) => (
                <div key={i} className="bg-[#1a1230] rounded-xl p-4 flex items-center justify-between" style={{ border: '1px solid rgba(247,148,29,0.08)' }}>
                  <div className="flex-1">
                    <p className="text-surface text-sm font-bold">{p.name}</p>
                    <div className="h-2 bg-white/5 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-btc rounded-full transition-all" style={{ width: `${p.probability}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button onClick={() => { const up = [...prizes]; up[i] = { ...up[i], probability: Math.max(5, up[i].probability - 5) }; setPrizes(up) }}
                      className="w-7 h-7 rounded-lg bg-night border border-white/10 text-surface/50 text-sm font-bold disabled:opacity-20" disabled={p.probability <= 5}>−</button>
                    <span className="text-btc font-bold text-sm w-10 text-center">{p.probability}%</span>
                    <button onClick={() => { const up = [...prizes]; up[i] = { ...up[i], probability: Math.min(95, up[i].probability + 5) }; setPrizes(up) }}
                      className="w-7 h-7 rounded-lg bg-night border border-white/10 text-surface/50 text-sm font-bold disabled:opacity-20" disabled={assignedTotal >= 100}>+</button>
                  </div>
                </div>
              ))}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-surface/40">Total: {assignedTotal}%</span>
                  <span className="text-surface/30">Try Again: {tryAgainPct}%</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(assignedTotal, 100)}%`, background: assignedTotal > 100 ? '#E53E3E' : '#F7941D' }} />
                </div>
                {assignedTotal > 100 && <p className="text-red-400 text-xs font-bold">Over 100% — reduce some chances</p>}
              </div>
            </div>
          )}

          {/* ─── STEP 5: ROI Preview ─── */}
          {step === 5 && (
            <div className="space-y-5">
              <h2 className="text-2xl font-black text-surface">ROI Preview</h2>
              <div>
                <label className="text-surface/50 text-xs font-bold flex items-center mb-1">Expected customers <Tooltip text="How many customers do you expect during this sale? Used to calculate your maximum cost after free tier." /></label>
                <input type="number" value={expectedCustomers} onChange={e => setExpectedCustomers(e.target.value)} min="1"
                  className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none" />
              </div>
              <div>
                <label className="text-surface/50 text-xs font-bold flex items-center mb-1">Avg check size ($) <Tooltip text="Your typical order size. Used to estimate revenue potential." /></label>
                <input type="number" value={avgSpend} onChange={e => setAvgSpend(e.target.value)} min="1"
                  className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-btc focus:outline-none" />
              </div>
              <div className="bg-[#1a1230] rounded-2xl p-5 space-y-4" style={{ border: '1px solid rgba(247,148,29,0.1)' }}>
                <div className="flex justify-between items-center">
                  <span className="text-surface/50 text-sm flex items-center">Campaign cost <Tooltip text="During your free tier this is $0. After your first 100-visit month, you pay $1.50 per confirmed visit." /></span>
                  <div>
                    <span className="text-surface/30 text-sm line-through mr-2">${(custNum * 1.5).toFixed(0)}</span>
                    <span className="bg-teal/20 text-teal text-xs font-bold px-2 py-0.5 rounded-full">FREE until proven</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-surface/50 text-sm">Revenue potential</span>
                  <span className="text-surface font-bold">${revenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-surface/50 text-sm">Cost per verified visit</span>
                  <span className="text-surface/30 text-sm">$1.50 (after free tier)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-surface/50 text-sm flex items-center">ROI multiplier <Tooltip text="Estimated return based on your inputs. You only pay for customers who physically walk in." /></span>
                  <span className="text-teal font-black text-2xl">{roi > 0 ? `${roi.toFixed(1)}x` : '—'}</span>
                </div>
              </div>
              <div className="rounded-xl p-3 text-xs text-surface/50 leading-relaxed" style={{ background: 'rgba(29,158,117,0.05)', border: '1px solid rgba(29,158,117,0.15)' }}>
                No cost until it works. Your first 100 visits are free so you can prove the ROI yourself before paying anything.
              </div>
            </div>
          )}

          {/* ─── STEP 6: Go Live ─── */}
          {step === 6 && (
            <div className="space-y-5">
              {isLive ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-teal rounded-full animate-pulse" />
                    <h2 className="text-2xl font-black text-surface">Your sale is live!</h2>
                  </div>
                  <div className="bg-[#1a1230] rounded-xl p-4" style={{ border: '1px solid rgba(29,158,117,0.2)' }}>
                    <p className="text-surface font-bold">{saleName || 'Flash Sale'}</p>
                    <p className="text-surface/40 text-xs">{startLabel} – {endLabel} · {repeat}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Notified', value: liveMetrics.notified },
                      { label: 'Spun', value: liveMetrics.spun },
                      { label: 'Claimed', value: liveMetrics.claimed },
                      { label: 'Visited', value: liveMetrics.visited },
                    ].map(m => (
                      <div key={m.label} className="bg-[#1a1230] rounded-xl p-3 text-center">
                        <p className="text-xl font-black text-surface">{m.value}</p>
                        <p className="text-surface/40 text-[10px]">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-3">
                    <button onClick={() => {
                      if (navigator.share) navigator.share({ title: saleName, text: `Check out ${saleName} on SerendipEatery!`, url: window.location.origin }).catch(() => {})
                    }} className="w-full bg-btc text-night font-bold py-3 rounded-xl">Share your sale</button>
                    <Link href="/business/promotions" className="w-full text-center bg-white/5 text-surface/50 font-bold py-3 rounded-xl">View Full Dashboard</Link>
                    <button onClick={() => { setStep(1); setIsLive(false); setPrizes([]); setSaleName('') }}
                      className="text-btc text-sm hover:underline text-center">Create another promotion</button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <h2 className="text-2xl font-black text-surface mb-2">Ready to go live?</h2>
                  <p className="text-surface/40 text-sm mb-6">{saleName} · {startLabel} – {endLabel} · {prizes.length} prizes</p>
                  <button onClick={goLive} className="bg-btc text-night font-bold text-lg px-10 py-4 rounded-full hover:bg-btc-dark transition">
                    Go Live
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Nav + Progress dots */}
      <div className="px-6 pb-6 max-w-lg mx-auto w-full">
        {step < 6 && (
          <div className="flex gap-3 mb-4">
            {step > 1 && (
              <button onClick={prev} className="flex-1 border border-surface/10 text-surface/50 font-bold py-3 rounded-xl text-sm">Back</button>
            )}
            {step < 5 ? (
              <button onClick={next} disabled={!canProceed(step)}
                className="flex-1 bg-btc text-night font-bold py-3 rounded-xl text-sm hover:bg-btc-dark transition disabled:opacity-40">
                Next
              </button>
            ) : step === 5 ? (
              <button onClick={() => goTo(6)}
                className="flex-1 bg-btc text-night font-bold py-3 rounded-xl text-sm hover:bg-btc-dark transition">
                Review & Go Live
              </button>
            ) : null}
          </div>
        )}
        <div className="flex justify-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(s => (
            <button key={s} onClick={() => goTo(s)}
              className="rounded-full transition-all"
              style={{
                width: s === step ? 12 : 8,
                height: 8,
                background: s < step ? '#1D9E75' : s === step ? '#F7941D' : 'rgba(255,248,242,0.15)',
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulseOrange {
          0%, 100% { border-color: rgba(247,148,29,0.1); }
          50% { border-color: rgba(247,148,29,0.5); }
        }
      `}</style>
    </main>
  )
}
