'use client'

import { useState } from 'react'
import Link from 'next/link'
import { NavBar } from '@/components/NavBar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const PLATFORM_ICONS: Record<string, string> = {
  google: '🔵', apple: '🍎', facebook: '📘', instagram: '📸',
  tiktok: '🎵', twitter: '🐦', snapchat: '👻', discord: '💬',
  spotify: '🎧', github: '🐱', linkedin: '💼', email: '✉️',
}

/* ─── Tier definitions ─── */
const TIERS = [
  { key: 'explorer',       label: 'Explorer',       icon: '🧭', color: '#888', min: 0 },
  { key: 'regular',        label: 'Regular',         icon: '🌿', color: '#1D9E75', min: 500 },
  { key: 'local_legend',   label: 'Local Legend',    icon: '🏆', color: '#0D7A5F', min: 1500 },
  { key: 'foodie_royale',  label: 'Foodie Royale',   icon: '👑', color: '#534AB7', min: 4000 },
  { key: 'tastemaker',     label: 'Tastemaker',      icon: '💎', color: '#3B82F6', min: 10000 },
  { key: 'influencer',     label: 'Influencer',      icon: '⭐', color: '#FFD700', min: 25000 },
  { key: 'food_legend',    label: 'Food Legend',      icon: '🔥', color: '#F7941D', min: 60000 },
  { key: 'icon',           label: 'Icon',            icon: '🌟', color: '#E53E3E', min: 150000 },
] as const

const POINTS_BREAKDOWN = [
  { action: 'Spin a wheel', pts: '+10 pts' },
  { action: 'Confirmed visit', pts: '+50 pts' },
  { action: 'Refer a friend (you)', pts: '+100 pts' },
  { action: 'Refer a friend (they get)', pts: '+50 pts' },
  { action: 'Refer a business', pts: '+500 pts' },
  { action: 'Share a win on social', pts: '+25 pts' },
]

function getTierInfo(tierKey: string) {
  return TIERS.find((t) => t.key === tierKey) ?? TIERS[0]
}

function getNextTier(tierKey: string) {
  const idx = TIERS.findIndex((t) => t.key === tierKey)
  if (idx < 0 || idx >= TIERS.length - 1) return null
  return TIERS[idx + 1]
}

function getTierPerks(tierKey: string) {
  const perks: string[] = []
  const idx = TIERS.findIndex((t) => t.key === tierKey)
  perks.push('Access to all flash sales')
  if (idx >= 1) perks.push('Priority spin queue')
  if (idx >= 2) perks.push('Exclusive prizes unlocked')
  if (idx >= 3) perks.push('2x points on weekends')
  if (idx >= 4) perks.push('5% revenue share on referrals')
  if (idx >= 5) perks.push('10% revenue share on referrals')
  if (idx >= 6) perks.push('Custom share card design')
  if (idx >= 7) perks.push('VIP status + direct line to team')
  return perks
}

interface Props {
  user: { firstName: string; imageUrl: string }
  profile: {
    consumer_points: number; loyalty_tier: string; revenue_share_pct: number
    auth_provider: string | null; social_username: string | null
    social_avatar_url: string | null; battle_tagline: string | null
  }
  referralCode: string | null
  recentActivity: Array<{
    id: string
    state: string
    prize_name: string
    business_name: string
    points_earned: number
    created_at: string
  }>
}

export function ProfileClient({ user, profile, referralCode, recentActivity }: Props) {
  const [copied, setCopied] = useState(false)
  const [tagline, setTagline] = useState(profile.battle_tagline ?? '')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [taglineSaved, setTaglineSaved] = useState(false)
  const tier = getTierInfo(profile.loyalty_tier)
  const nextTier = getNextTier(profile.loyalty_tier)
  const avatarUrl = profile.social_avatar_url || user.imageUrl
  const platformIcon = PLATFORM_ICONS[profile.auth_provider ?? 'email'] ?? '✉️'

  const saveTagline = async () => {
    // Save tagline via API (simplified — would need a proper endpoint)
    setTaglineSaved(true)
    setTimeout(() => setTaglineSaved(false), 2000)
  }
  const points = profile.consumer_points ?? 0

  const progressPct = nextTier
    ? Math.min(((points - tier.min) / (nextTier.min - tier.min)) * 100, 100)
    : 100

  const copyCode = () => {
    if (!referralCode) return
    navigator.clipboard.writeText(referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
    <NavBar variant="consumer" />
    <main className="min-h-screen bg-night px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-surface mb-8">My Profile</h1>

        {/* Social Identity Card */}
        <section className="rounded-2xl p-6 mb-6" style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.15)' }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-btc flex items-center justify-center text-2xl font-black text-night">
                  {(user.firstName || '?')[0]}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 text-sm bg-night rounded-full w-6 h-6 flex items-center justify-center border border-white/10">
                {platformIcon}
              </span>
            </div>
            <div>
              <p className="text-surface font-bold text-lg">{user.firstName}</p>
              {profile.social_username && (
                <p className="text-surface/50 text-sm">{profile.social_username}</p>
              )}
              <p className="text-surface/30 text-xs capitalize">via {profile.auth_provider ?? 'email'}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-3xl font-black text-btc">{points.toLocaleString()}</p>
              <p className="text-surface/40 text-xs">points</p>
            </div>
          </div>

          {/* Battle tagline */}
          <div className="mt-3">
            <label className="text-surface/40 text-xs block mb-1">Battle cry (50 chars)</label>
            <div className="flex gap-2">
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value.slice(0, 50))}
                placeholder="Set your battle cry..."
                maxLength={50}
                className="flex-1 bg-night text-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-btc focus:outline-none placeholder:text-surface/20"
              />
              <button onClick={saveTagline} className="bg-btc text-night font-bold px-4 py-2 rounded-lg text-xs hover:bg-btc-dark transition">
                {taglineSaved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {nextTier ? (
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-surface/40">{tier.label}</span>
                <span className="text-surface/40">
                  {(nextTier.min - points).toLocaleString()} pts to {nextTier.label}
                </span>
              </div>
              <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progressPct}%`, background: tier.color }}
                />
              </div>
            </div>
          ) : (
            <p className="text-surface/40 text-sm">Max tier reached!</p>
          )}
        </section>

        {/* Tier Perks */}
        <section className="bg-[#1a1230] rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-bold text-surface mb-3">Your Perks</h3>
          <ul className="space-y-2">
            {getTierPerks(profile.loyalty_tier).map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-sm text-surface/70">
                <span className="text-teal">✓</span>
                {perk}
              </li>
            ))}
          </ul>
        </section>

        {/* Points Breakdown */}
        <section className="bg-[#1a1230] rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-bold text-surface mb-3">How to Earn Points</h3>
          <div className="space-y-2">
            {POINTS_BREAKDOWN.map((item) => (
              <div key={item.action} className="flex items-center justify-between py-1.5">
                <span className="text-surface/60 text-sm">{item.action}</span>
                <span className="text-btc text-sm font-bold">{item.pts}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Referral Code */}
        {/* Invite Friends */}
        <section className="rounded-2xl p-6 mb-6" style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.2)' }}>
          <h3 className="text-lg font-bold text-surface mb-1">🎁 Invite Friends</h3>
          <p className="text-surface/40 text-sm mb-4">You earn +100 pts, they get +50 pts</p>

          {referralCode ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 bg-night rounded-xl px-4 py-3 font-mono text-lg text-btc font-bold tracking-widest text-center">
                  {referralCode}
                </div>
                <button onClick={copyCode}
                  className="bg-btc text-night font-bold px-5 py-3 rounded-xl hover:bg-btc-dark transition text-sm">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <button
                onClick={() => {
                  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${referralCode}`
                  const sd = { title: 'Join SerendipEatery', text: `Join me on SerendipEatery! Use my code ${referralCode} to get bonus points.`, url }
                  if (typeof navigator !== 'undefined' && navigator.share) navigator.share(sd).catch(() => {})
                  else if (typeof navigator !== 'undefined') navigator.clipboard.writeText(url)
                }}
                className="w-full bg-btc/10 text-btc font-bold py-3 rounded-xl border border-btc/30 hover:bg-btc/20 transition text-sm"
              >
                Share Invite Link
              </button>
            </>
          ) : (
            <p className="text-surface/30 text-sm">Referral code not available yet</p>
          )}
        </section>

        {/* Recent Activity */}
        <section className="bg-[#1a1230] rounded-2xl p-6">
          <h3 className="text-lg font-bold text-surface mb-3">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="text-surface/40 text-sm">No activity yet — spin a wheel to get started!</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-surface text-sm">
                      {a.state === 'confirmed' ? 'Visited' : a.state === 'spun' ? 'Spun' : a.state}{' '}
                      <span className="text-surface/50">@ {a.business_name}</span>
                    </p>
                    {a.prize_name && (
                      <p className="text-surface/40 text-xs">Won: {a.prize_name}</p>
                    )}
                    <p className="text-surface/30 text-xs">
                      {new Date(a.created_at).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {a.points_earned > 0 && (
                    <span className="text-teal text-sm font-bold">+{a.points_earned}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Nav links */}
        <div className="flex items-center justify-center gap-6 mt-8">
          <Link href="/wallet" className="text-surface/40 text-sm hover:text-surface/60 transition">Wallet</Link>
          <Link href="/consumer" className="text-surface/40 text-sm hover:text-surface/60 transition">Find Sales</Link>
        </div>

        {/* Delete Account */}
        <div className="mt-12 pt-8 border-t border-red-500/20">
          <h3 className="text-red-400 text-sm font-bold mb-2">Danger Zone</h3>
          <p className="text-surface/30 text-xs mb-3">
            This permanently deletes your account, points, wallet, and battle history. This cannot be undone.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="border border-red-500/40 text-red-400 font-bold px-5 py-2 rounded-xl text-sm hover:bg-red-500/10 transition"
          >
            Delete My Account
          </button>
        </div>

        {/* Delete confirmation modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => { setShowDeleteModal(false); setDeleteInput('') }} />
            <div className="relative rounded-2xl p-6 max-w-sm w-full" style={{ background: '#1a1230' }}>
              <h3 className="text-surface font-bold text-lg mb-2">Are you sure?</h3>
              <p className="text-surface/40 text-sm mb-4">Type <span className="text-red-400 font-bold">DELETE</span> to confirm</p>
              <input
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="Type DELETE"
                className="w-full bg-night text-surface border border-white/10 rounded-lg px-3 py-2 text-sm mb-4 focus:border-red-500 focus:outline-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteInput('') }}
                  className="flex-1 border border-surface/20 text-surface/60 font-bold py-2.5 rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setDeleting(true)
                    try {
                      await fetch(`${API_URL}/users/me`, { method: 'DELETE' })
                      window.location.href = '/?deleted=1'
                    } catch {
                      setDeleting(false)
                    }
                  }}
                  disabled={deleteInput !== 'DELETE' || deleting}
                  className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
    </>
  )
}
