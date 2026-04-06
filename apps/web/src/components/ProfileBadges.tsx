'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from './Badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function getGuestId(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('se_guest_id') || ''
}

interface HolderEntry {
  id: string
  badge_id: string
  user_id: string
  user_name: string
  held_from: string
  held_until: string | null
  is_current: boolean
  trigger_context: any
  superseded_by: string | null
  badge_definitions: {
    id: string
    name: string
    description: string
    icon: string
    badge_category: string
    traveling: boolean
    flavor_text: string | null
  }
}

export function ProfileBadges() {
  const [current, setCurrent] = useState<HolderEntry[]>([])
  const [former, setFormer] = useState<HolderEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userId = getGuestId()
    if (!userId) { setLoading(false); return }

    fetch(`${API_URL}/badges/user/${userId}`)
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          setCurrent(json.data.current)
          setFormer(json.data.former)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return null
  if (current.length === 0 && former.length === 0) return null

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function daysHeld(from: string, until: string | null): number {
    const f = new Date(from)
    const u = until ? new Date(until) : new Date()
    return Math.max(1, Math.round((u.getTime() - f.getTime()) / 86400000))
  }

  return (
    <section className="bg-[#1a1230] rounded-2xl p-6">
      {/* Current Badges */}
      {current.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-bold text-surface mb-3">Current Badges</h3>
          <div className="flex flex-wrap gap-3">
            {current.map(h => (
              <Link key={h.id} href={`/badges/${h.badge_id}`}
                className="flex items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/5"
                style={{
                  background: '#1a0e00',
                  border: '1px solid rgba(247,148,29,0.3)',
                  boxShadow: '0 0 8px rgba(247,148,29,0.15)',
                }}>
                <span className="text-xl">{h.badge_definitions.icon}</span>
                <div>
                  <p className="text-surface font-bold text-xs">{h.badge_definitions.name}</p>
                  {h.badge_definitions.traveling && (
                    <span className="text-[9px] font-bold text-btc">TRAVELING</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Former Titles */}
      {former.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-surface/50 mb-2">Former Titles</h3>
          <div className="space-y-2">
            {former.map(h => (
              <Link key={h.id} href={`/badges/${h.badge_id}`}
                className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-white/5"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-lg" style={{ filter: 'grayscale(1) opacity(0.4)' }}>
                  {h.badge_definitions.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-surface/40 text-xs font-bold">Formerly held {h.badge_definitions.name}</p>
                  <p className="text-surface/20 text-[10px]">
                    Held {daysHeld(h.held_from, h.held_until)} days · {formatDate(h.held_from)} – {formatDate(h.held_until!)}
                  </p>
                  {h.superseded_by && (
                    <p className="text-surface/15 text-[10px]">Taken by another challenger</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
