'use client'

import { useState } from 'react'
import Link from 'next/link'

interface FreeTierBannerProps {
  plan: string
  shadowMode: boolean
  shadowModeReason?: string
  missedCount?: number
  shadowModeAt?: string
  visitLimit?: number
  freeTierGraduated?: boolean
  visitsThisMonth?: number
  peakMonthlyVisits?: number
}

export function FreeTierBanner({
  plan,
  shadowMode,
  shadowModeReason,
  missedCount = 0,
  shadowModeAt,
  visitLimit,
  freeTierGraduated,
  visitsThisMonth = 0,
  peakMonthlyVisits = 0,
}: FreeTierBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const sinceDate = shadowModeAt ? new Date(shadowModeAt).toLocaleDateString() : 'recently'
  const isFree = plan === 'trial'

  // Shadow mode active (any plan)
  if (shadowMode) {
    return (
      <div className="w-full rounded-2xl p-5 mb-6" style={{ background: '#7a3800', border: '1px solid #F7941D' }}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🌑</span>
              <h3 className="text-surface font-bold text-lg">Your promotions are in shadow mode</h3>
            </div>
            <p className="text-surface/70 text-sm mb-2">
              You've reached your {visitLimit ?? 'plan'} visit limit for this period. Customers in your area are being tracked but not receiving notifications.
            </p>
            <p className="text-surface/50 text-xs mb-4">
              Missed opportunities: <span className="text-btc font-bold">{missedCount}</span> potential customers since {sinceDate}
            </p>
            <div className="flex gap-3">
              <Link href="/billing" className="bg-btc text-night font-bold px-5 py-2 rounded-xl text-sm hover:bg-btc-dark transition">
                Upgrade Plan
              </Link>
              <Link href="/business/promotions" className="text-btc text-sm hover:underline flex items-center">
                View Missed Data →
              </Link>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="text-surface/30 hover:text-surface/50 text-lg ml-4">×</button>
        </div>
      </div>
    )
  }

  // Free tier — not graduated (honeymoon phase)
  if (isFree && !freeTierGraduated) {
    return (
      <div className="w-full rounded-2xl p-5 mb-6" style={{ background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.3)' }}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">✅</span>
              <h3 className="text-teal font-bold">Free tier — full access until you hit 100 visits/month</h3>
            </div>
            <p className="text-surface/50 text-sm">
              This month: <span className="text-surface font-bold">{visitsThisMonth}</span> visits — <span className="text-teal font-bold">{Math.max(0, 100 - visitsThisMonth)}</span> until upgrade prompt
            </p>
          </div>
          <button onClick={() => setDismissed(true)} className="text-surface/30 hover:text-surface/50 text-lg ml-4">×</button>
        </div>
      </div>
    )
  }

  // Free tier — graduated but not yet in shadow mode (visits remaining)
  if (isFree && freeTierGraduated && !shadowMode) {
    const remaining = Math.max(0, 5 - visitsThisMonth)
    return (
      <div className="w-full rounded-2xl p-5 mb-6" style={{ background: 'rgba(247,148,29,0.1)', border: '1px solid rgba(247,148,29,0.3)' }}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">⚠️</span>
              <h3 className="text-btc font-bold">Free tier — {remaining} visits remaining this month</h3>
            </div>
            {missedCount > 0 && (
              <p className="text-surface/50 text-sm">
                {missedCount} missed opportunities from last month
              </p>
            )}
          </div>
          <button onClick={() => setDismissed(true)} className="text-surface/30 hover:text-surface/50 text-lg ml-4">×</button>
        </div>
      </div>
    )
  }

  return null
}

// Re-export for backward compatibility
export { FreeTierBanner as ShadowModeBanner }
