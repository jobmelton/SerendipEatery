'use client'

import { useState } from 'react'
import Link from 'next/link'

interface BadgeProps {
  badgeId: string
  icon: string
  name: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  muted?: boolean
}

export function Badge({ badgeId, icon, name, description, size = 'md', showTooltip = true, muted = false }: BadgeProps) {
  const [hover, setHover] = useState(false)

  const fontSize = size === 'lg' ? '2rem' : size === 'sm' ? '1rem' : '1.4rem'

  return (
    <Link href={`/badges/${badgeId}`} style={{ textDecoration: 'none' }}>
      <div
        className="relative inline-flex items-center gap-1 cursor-pointer"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <span style={{
          fontSize,
          filter: muted ? 'grayscale(1) opacity(0.4)' : 'none',
          display: 'inline-block',
        }}>
          {icon}
        </span>

        {showTooltip && hover && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
            style={{ minWidth: 180 }}>
            <div className="rounded-xl px-3 py-2 text-center" style={{ background: '#1a0e00', border: '1px solid rgba(247,148,29,0.3)' }}>
              <p className="text-surface font-bold text-xs">{name}</p>
              {description && <p className="text-surface/50 text-[10px] mt-0.5">{description}</p>}
              <p className="text-btc text-[10px] mt-1 font-bold">Click to see all holders →</p>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
