'use client'

import { useState } from 'react'

interface Props {
  sales: any[]
  visitCounts: Record<string, number>
}

export function SalesClient({ sales: initialSales, visitCounts }: Props) {
  const [sales, setSales] = useState(initialSales)

  const onForceEnd = async (saleId: string) => {
    if (!confirm('Force-end this sale?')) return
    try {
      const res = await fetch(`/api/admin/sales/${saleId}/end`, { method: 'POST' })
      if (res.ok) {
        setSales(sales.map((s) => s.id === saleId ? { ...s, status: 'ended' } : s))
      }
    } catch { /* */ }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-surface mb-6">Active Sales</h1>

      <div className="bg-[#1a1230] rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left text-surface/40 text-xs font-medium p-4">Business</th>
              <th className="text-left text-surface/40 text-xs font-medium p-4">Status</th>
              <th className="text-left text-surface/40 text-xs font-medium p-4">Spins</th>
              <th className="text-left text-surface/40 text-xs font-medium p-4">Visits</th>
              <th className="text-left text-surface/40 text-xs font-medium p-4">Conv.</th>
              <th className="text-left text-surface/40 text-xs font-medium p-4">Time</th>
              <th className="text-left text-surface/40 text-xs font-medium p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => {
              const visits = visitCounts[sale.id] ?? 0
              const conv = sale.spins_used > 0 ? Math.round((visits / sale.spins_used) * 100) : 0
              const endsAt = new Date(sale.ends_at)
              const diff = endsAt.getTime() - Date.now()
              const minsLeft = diff > 0 ? Math.floor(diff / 60000) : 0

              return (
                <tr key={sale.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="p-4">
                    <p className="text-surface font-medium text-sm">{sale.businesses?.name ?? '—'}</p>
                    <p className="text-surface/40 text-xs">{sale.businesses?.type}</p>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      sale.status === 'live' ? 'bg-teal/20 text-teal' : 'bg-purple/20 text-purple'
                    }`}>
                      {sale.status}
                    </span>
                  </td>
                  <td className="p-4 text-surface text-sm">{sale.spins_used}/{sale.max_spins_total}</td>
                  <td className="p-4 text-surface text-sm">{visits}</td>
                  <td className="p-4 text-surface text-sm">{conv}%</td>
                  <td className="p-4 text-surface/50 text-sm">
                    {sale.status === 'live' ? `${minsLeft}m left` : 'Scheduled'}
                  </td>
                  <td className="p-4">
                    {sale.status === 'live' && (
                      <button
                        onClick={() => onForceEnd(sale.id)}
                        className="text-red-400 text-xs font-bold hover:text-red-300 transition"
                      >
                        Force End
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {sales.length === 0 && (
          <p className="text-surface/40 text-sm text-center py-8">No active sales</p>
        )}
      </div>
    </div>
  )
}
