'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function getGuestId(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('se_guest_id') || ''
}

interface BadgeDef {
  id: string
  name: string
  description: string
  icon: string
  badge_category: string
  traveling: boolean
  flavor_text: string | null
}

interface Holder {
  id: string
  badge_id: string
  user_id: string
  user_name: string
  user_avatar: string | null
  held_from: string
  held_until: string | null
  is_current: boolean
  trigger_context: any
  superseded_by: string | null
}

interface Stats {
  totalTransfers: number
  longestReignDays: number
  longestReignHolder: string
  mostRecentTransferDaysAgo: number | null
  averageReignDays: number
}

type SortMode = 'longest' | 'recent' | 'alpha'

export default function BadgeLineagePage() {
  const { badgeId } = useParams<{ badgeId: string }>()
  const [badge, setBadge] = useState<BadgeDef | null>(null)
  const [currentHolders, setCurrentHolders] = useState<Holder[]>([])
  const [history, setHistory] = useState<Holder[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const myId = getGuestId()

  useEffect(() => {
    if (!badgeId) return
    fetch(`${API_URL}/badges/${badgeId}`)
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          setBadge(json.data.badge)
          setCurrentHolders(json.data.currentHolders)
          setHistory(json.data.history)
          setStats(json.data.stats)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [badgeId])

  if (loading) {
    return (
      <main className="min-h-screen bg-night flex items-center justify-center">
        <p className="text-surface/40 animate-pulse">Loading badge...</p>
      </main>
    )
  }

  if (!badge) {
    return (
      <main className="min-h-screen bg-night flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-red-400 text-xl font-bold mb-4">Badge not found</p>
          <Link href="/" className="text-btc hover:underline">Home</Link>
        </div>
      </main>
    )
  }

  // Group co-holders (draw streak) by held_from date
  const isDrawStreak = badge.id === 'longest_draw_streak'

  function daysHeld(h: Holder): number {
    const from = new Date(h.held_from)
    const until = h.held_until ? new Date(h.held_until) : new Date()
    return Math.max(1, Math.round((until.getTime() - from.getTime()) / 86400000))
  }

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Deduplicate co-holders for display (group by held_from within 1 minute)
  const uniqueEntries: Array<{ holders: Holder[]; days: number }> = []
  const seen = new Set<string>()

  for (const h of history) {
    const key = `${h.held_from.slice(0, 16)}-${h.badge_id}`
    if (seen.has(key + h.user_id)) continue
    seen.add(key + h.user_id)

    // Find co-holder
    const coHolder = isDrawStreak
      ? history.find(x => x.id !== h.id && x.held_from.slice(0, 16) === h.held_from.slice(0, 16) && !seen.has(key + x.user_id))
      : null

    if (coHolder) seen.add(key + coHolder.user_id)

    const holders = coHolder ? [h, coHolder] : [h]
    uniqueEntries.push({ holders, days: daysHeld(h) })
  }

  // Sort
  const sorted = [...uniqueEntries].sort((a, b) => {
    if (sortMode === 'longest') return b.days - a.days
    if (sortMode === 'alpha') return a.holders[0].user_name.localeCompare(b.holders[0].user_name)
    return new Date(b.holders[0].held_from).getTime() - new Date(a.holders[0].held_from).getTime()
  })

  return (
    <main className="min-h-screen bg-night flex flex-col items-center px-6 pt-10 pb-16">
      <Link href="/" className="fixed top-4 left-4 z-40" style={{ color: '#b8a898', fontSize: '0.9rem' }}>
        ← Home
      </Link>

      {/* Badge header */}
      <div className="text-center max-w-md mb-8">
        <span className="text-6xl block mb-3">{badge.icon}</span>
        <h1 className="text-3xl font-black text-surface mb-1">{badge.name}</h1>
        <p className="text-surface/60 text-sm mb-2">{badge.description}</p>
        {badge.flavor_text && (
          <p className="text-btc/60 text-sm italic">"{badge.flavor_text}"</p>
        )}
        {badge.traveling && (
          <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-btc/20 text-btc">TRAVELING BADGE</span>
        )}
      </div>

      {/* Current holders */}
      <div className="w-full max-w-md mb-8">
        <p className="text-surface/50 text-xs font-bold mb-3 tracking-wider">CURRENT HOLDER{currentHolders.length > 1 ? 'S' : ''}</p>
        {currentHolders.length === 0 ? (
          <div className="rounded-xl p-4 text-center" style={{ background: '#1a1230' }}>
            <p className="text-surface/40 text-sm">No one holds this badge yet</p>
          </div>
        ) : (
          <div className="flex gap-3 justify-center">
            {currentHolders.map((h, i) => (
              <div key={h.id} className="flex items-center gap-3">
                {i > 0 && isDrawStreak && <span className="text-2xl">🤝</span>}
                <div className="rounded-xl p-4 text-center flex-1" style={{ background: '#1a0e00', border: '2px solid #F7941D', minWidth: 160 }}>
                  <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-2xl"
                    style={{ background: '#1a1230', border: '2px solid #F7941D' }}>
                    {h.user_avatar ? <img src={h.user_avatar} alt="" className="w-full h-full rounded-full" /> : h.user_name[0]?.toUpperCase()}
                  </div>
                  <p className="text-surface font-bold text-sm">{h.user_name}</p>
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal/20 text-teal mt-1">Current Holder</span>
                  <p className="text-surface/40 text-xs mt-1">Held since {formatDate(h.held_from)}</p>
                  {h.trigger_context?.streak_count && (
                    <p className="text-btc text-xs font-bold mt-1">{h.trigger_context.streak_count} consecutive draws</p>
                  )}
                  {h.trigger_context?.total_wins && (
                    <p className="text-btc text-xs font-bold mt-1">{h.trigger_context.total_wins} battle wins</p>
                  )}
                  {h.trigger_context?.player_count && (
                    <p className="text-btc text-xs font-bold mt-1">{h.trigger_context.player_count} players hosted</p>
                  )}
                  {h.trigger_context?.total_points && (
                    <p className="text-btc text-xs font-bold mt-1">{h.trigger_context.total_points.toLocaleString()} points</p>
                  )}
                  {h.user_id === myId && <p className="text-teal text-xs font-bold mt-1">That's you!</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lineage leaderboard */}
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-surface/50 text-xs font-bold tracking-wider">ALL WHO HAVE HELD THIS TITLE</p>
          <div className="flex gap-1">
            {(['recent', 'longest', 'alpha'] as SortMode[]).map(mode => (
              <button key={mode} onClick={() => setSortMode(mode)}
                className="text-[10px] font-bold px-2 py-1 rounded-lg transition"
                style={{
                  background: sortMode === mode ? '#F7941D' : '#1a1230',
                  color: sortMode === mode ? '#0f0a1e' : 'rgba(255,248,242,0.4)',
                }}>
                {mode === 'recent' ? 'Recent' : mode === 'longest' ? 'Longest' : 'A-Z'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {sorted.map((entry, i) => {
            const primary = entry.holders[0]
            const isMe = entry.holders.some(h => h.user_id === myId)
            const isCurrent = primary.is_current

            return (
              <div key={primary.id} className="rounded-xl p-3"
                style={{
                  background: '#1a1230',
                  border: isCurrent ? '1px solid #F7941D' : isMe ? '1px solid rgba(29,158,117,0.3)' : '1px solid rgba(255,255,255,0.05)',
                }}>
                <div className="flex items-start gap-3">
                  <span className="text-surface/30 text-xs font-bold mt-1 w-5 shrink-0">#{i + 1}</span>
                  <span className="text-lg shrink-0">{badge.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className={`font-bold text-sm truncate ${isCurrent ? 'text-btc' : isMe ? 'text-teal' : 'text-surface/70'}`}>
                        {entry.holders.map(h => h.user_name).join(' & ')}
                      </p>
                      {isMe && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-teal/20 text-teal shrink-0">YOU</span>}
                      {isCurrent && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-btc/20 text-btc shrink-0">CURRENT</span>}
                    </div>
                    <p className="text-surface/30 text-xs">
                      {formatDate(primary.held_from)}{primary.held_until ? ` – ${formatDate(primary.held_until)}` : ' – present'}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-surface/40 text-xs">{entry.days} day{entry.days !== 1 ? 's' : ''} held</span>
                      {primary.trigger_context?.streak_count && (
                        <span className="text-btc/60 text-xs">Record: {primary.trigger_context.streak_count} draws</span>
                      )}
                      {primary.trigger_context?.total_wins && (
                        <span className="text-btc/60 text-xs">{primary.trigger_context.total_wins} wins</span>
                      )}
                    </div>
                    {primary.superseded_by && !primary.is_current && (
                      <p className="text-surface/20 text-[10px] mt-0.5">Taken by another challenger</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {sorted.length === 0 && (
          <p className="text-surface/30 text-sm text-center py-6">No one has held this badge yet.</p>
        )}
      </div>

      {/* Stats */}
      {stats && (stats.totalTransfers > 0 || currentHolders.length > 0) && (
        <div className="w-full max-w-md">
          <p className="text-surface/50 text-xs font-bold mb-3 tracking-wider">STATS</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 text-center" style={{ background: '#1a1230' }}>
              <p className="text-btc font-black text-xl">{stats.totalTransfers}</p>
              <p className="text-surface/40 text-xs">Times transferred</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: '#1a1230' }}>
              <p className="text-btc font-black text-xl">{stats.longestReignDays}d</p>
              <p className="text-surface/40 text-xs">Longest reign</p>
              {stats.longestReignHolder && <p className="text-surface/30 text-[10px]">{stats.longestReignHolder}</p>}
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: '#1a1230' }}>
              <p className="text-btc font-black text-xl">{stats.averageReignDays}d</p>
              <p className="text-surface/40 text-xs">Avg reign</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: '#1a1230' }}>
              <p className="text-btc font-black text-xl">{stats.mostRecentTransferDaysAgo ?? '—'}{stats.mostRecentTransferDaysAgo != null ? 'd' : ''}</p>
              <p className="text-surface/40 text-xs">Last transfer</p>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
