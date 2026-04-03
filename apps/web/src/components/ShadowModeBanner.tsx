'use client'

import { useState } from 'react'
import Link from 'next/link'

interface ShadowModeBannerProps {
  shadowMode: boolean
  reason?: string
  missedCount?: number
  shadowModeAt?: string
  visitLimit?: number
}

export function ShadowModeBanner({ shadowMode, reason, missedCount = 0, shadowModeAt, visitLimit }: ShadowModeBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (!shadowMode || dismissed) return null

  const sinceDate = shadowModeAt ? new Date(shadowModeAt).toLocaleDateString() : 'recently'

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
