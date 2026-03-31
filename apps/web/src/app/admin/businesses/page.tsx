import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const planColors: Record<string, string> = {
  trial: 'bg-surface/10 text-surface/60',
  starter: 'bg-btc/20 text-btc',
  growth: 'bg-purple/20 text-purple',
  pro: 'bg-teal/20 text-teal',
}

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; sort?: string }>
}) {
  const params = await searchParams
  const planFilter = params.plan
  const sortBy = params.sort ?? 'created_at'

  let query = supabase
    .from('businesses')
    .select('*')

  if (planFilter) {
    query = query.eq('plan', planFilter)
  }

  query = query.order(sortBy === 'name' ? 'name' : 'created_at', { ascending: sortBy === 'name' })
  query = query.limit(100)

  const { data: businesses } = await query

  return (
    <div>
      <h1 className="text-2xl font-bold text-surface mb-6">Businesses</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <FilterLink href="/admin/businesses" label="All" active={!planFilter} />
        <FilterLink href="/admin/businesses?plan=trial" label="Trial" active={planFilter === 'trial'} />
        <FilterLink href="/admin/businesses?plan=starter" label="Starter" active={planFilter === 'starter'} />
        <FilterLink href="/admin/businesses?plan=growth" label="Growth" active={planFilter === 'growth'} />
        <FilterLink href="/admin/businesses?plan=pro" label="Pro" active={planFilter === 'pro'} />
      </div>

      {/* Table */}
      <div className="bg-[#1a1230] rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left text-surface/40 text-xs font-medium p-4">Name</th>
              <th className="text-left text-surface/40 text-xs font-medium p-4">Plan</th>
              <th className="text-left text-surface/40 text-xs font-medium p-4">Evidence</th>
              <th className="text-left text-surface/40 text-xs font-medium p-4">Locked</th>
              <th className="text-left text-surface/40 text-xs font-medium p-4">Tier</th>
              <th className="text-left text-surface/40 text-xs font-medium p-4">Points</th>
              <th className="text-left text-surface/40 text-xs font-medium p-4">Signed Up</th>
            </tr>
          </thead>
          <tbody>
            {(businesses ?? []).map((biz) => (
              <tr key={biz.id} className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="p-4">
                  <Link href={`/admin/businesses/${biz.id}`} className="text-surface font-medium hover:text-btc transition">
                    {biz.name}
                  </Link>
                  <p className="text-surface/40 text-xs mt-0.5">{biz.cuisine} • {biz.type}</p>
                </td>
                <td className="p-4">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${planColors[biz.plan] ?? planColors.trial}`}>
                    {biz.plan}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-surface text-sm font-bold">{biz.trial_evidence_score ?? 0}/5</span>
                </td>
                <td className="p-4">
                  {biz.trial_locked ? (
                    <span className="text-red-400 text-xs font-bold">LOCKED</span>
                  ) : (
                    <span className="text-surface/30 text-xs">—</span>
                  )}
                </td>
                <td className="p-4">
                  <span className="text-surface/70 text-sm capitalize">{biz.biz_tier}</span>
                </td>
                <td className="p-4">
                  <span className="text-surface/70 text-sm">{biz.biz_points ?? 0}</span>
                </td>
                <td className="p-4">
                  <span className="text-surface/40 text-xs">
                    {new Date(biz.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!businesses || businesses.length === 0) && (
          <p className="text-surface/40 text-sm text-center py-8">No businesses found</p>
        )}
      </div>
    </div>
  )
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
        active ? 'bg-btc text-night' : 'bg-white/5 text-surface/60 hover:bg-white/10'
      }`}
    >
      {label}
    </Link>
  )
}
