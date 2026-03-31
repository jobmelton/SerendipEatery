'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  business: any
  evidence: any
  billingEvents: any[]
  totalSales: number
  confirmedVisits: number
}

export function BusinessDetailClient({ business, evidence, billingEvents, totalSales, confirmedVisits }: Props) {
  const [plan, setPlan] = useState(business.plan)
  const [trialLocked, setTrialLocked] = useState(business.trial_locked ?? false)
  const [evidenceScore, setEvidenceScore] = useState(business.trial_evidence_score ?? 0)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const onSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/businesses/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          trialLocked,
          trialEvidenceScore: evidenceScore,
        }),
      })
      if (res.ok) {
        setMessage('Saved successfully')
      } else {
        setMessage('Failed to save')
      }
    } catch {
      setMessage('Error saving')
    }
    setSaving(false)
  }

  const thresholds = [
    { key: 'referral_visits', label: 'Referral Visits', target: 3 },
    { key: 'biz_referrals', label: 'Biz Referrals', target: 1 },
    { key: 'total_sales', label: 'Total Sales', target: 5 },
    { key: 'conversion_rate', label: 'Conversion Rate', target: 20 },
    { key: 'repeat_customers', label: 'Repeat Customers', target: 3 },
  ]

  return (
    <div>
      <Link href="/admin/businesses" className="text-btc text-sm font-medium hover:underline">
        &larr; All Businesses
      </Link>

      <h1 className="text-2xl font-bold text-surface mt-4 mb-2">{business.name}</h1>
      <p className="text-surface/50 text-sm mb-6">{business.cuisine} • {business.type} • {business.address_line}</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#1a1230] rounded-xl p-4">
          <p className="text-2xl font-extrabold text-surface">{totalSales}</p>
          <p className="text-surface/50 text-xs mt-1">Total Sales</p>
        </div>
        <div className="bg-[#1a1230] rounded-xl p-4">
          <p className="text-2xl font-extrabold text-surface">{confirmedVisits}</p>
          <p className="text-surface/50 text-xs mt-1">Confirmed Visits</p>
        </div>
        <div className="bg-[#1a1230] rounded-xl p-4">
          <p className="text-2xl font-extrabold text-surface capitalize">{business.biz_tier}</p>
          <p className="text-surface/50 text-xs mt-1">Tier</p>
        </div>
        <div className="bg-[#1a1230] rounded-xl p-4">
          <p className="text-2xl font-extrabold text-surface">{business.biz_points ?? 0}</p>
          <p className="text-surface/50 text-xs mt-1">Biz Points</p>
        </div>
      </div>

      {/* Evidence Thresholds */}
      <section className="bg-[#1a1230] rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-bold text-surface mb-4">Evidence Thresholds</h2>
        <div className="space-y-3">
          {thresholds.map((t) => {
            const current = evidence?.[t.key] ?? 0
            const met = current >= t.target
            const pct = Math.min(Math.round((current / t.target) * 100), 100)
            return (
              <div key={t.key} className="flex items-center gap-3">
                <span className="text-sm w-5">{met ? '✅' : '⬜'}</span>
                <span className="text-surface text-sm w-36">{t.label}</span>
                <div className="flex-1 h-2 bg-white/10 rounded overflow-hidden">
                  <div className={`h-full rounded ${met ? 'bg-teal' : 'bg-btc'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-surface/50 text-xs w-12 text-right">{current}/{t.target}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Admin Overrides */}
      <section className="bg-[#1a1230] rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-bold text-surface mb-4">Admin Override</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-surface/50 text-xs block mb-1">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full bg-night text-surface rounded-lg p-2 text-sm border border-white/10"
            >
              <option value="trial">Trial</option>
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="pro">Pro</option>
            </select>
          </div>
          <div>
            <label className="text-surface/50 text-xs block mb-1">Trial Locked</label>
            <select
              value={trialLocked ? 'true' : 'false'}
              onChange={(e) => setTrialLocked(e.target.value === 'true')}
              className="w-full bg-night text-surface rounded-lg p-2 text-sm border border-white/10"
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <div>
            <label className="text-surface/50 text-xs block mb-1">Evidence Score</label>
            <input
              type="number"
              min={0}
              max={5}
              value={evidenceScore}
              onChange={(e) => setEvidenceScore(Number(e.target.value))}
              className="w-full bg-night text-surface rounded-lg p-2 text-sm border border-white/10"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <button
            onClick={onSave}
            disabled={saving}
            className="bg-btc hover:bg-btc-dark text-night font-bold py-2 px-6 rounded-lg transition disabled:opacity-50 text-sm"
          >
            {saving ? 'Saving...' : 'Save Override'}
          </button>
          {message && <span className="text-teal text-sm">{message}</span>}
        </div>
      </section>

      {/* Billing History */}
      <section className="bg-[#1a1230] rounded-2xl p-6">
        <h2 className="text-lg font-bold text-surface mb-4">Billing History</h2>
        {billingEvents.length === 0 ? (
          <p className="text-surface/40 text-sm">No billing events</p>
        ) : (
          <div className="space-y-2">
            {billingEvents.map((event: any) => (
              <div key={event.id} className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <p className="text-surface text-sm">{event.type}</p>
                  <p className="text-surface/40 text-xs">
                    {new Date(event.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="text-btc text-sm font-bold">${(event.amount_cents / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
