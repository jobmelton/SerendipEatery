import { createClient } from '@supabase/supabase-js'
import { SalesClient } from './sales-client'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

export default async function AdminSalesPage() {
  const { data: sales } = await supabase
    .from('flash_sales')
    .select('*, businesses(name, type), prizes(*)')
    .in('status', ['live', 'scheduled'])
    .order('created_at', { ascending: false })
    .limit(100)

  // Get visit counts per sale
  const saleIds = (sales ?? []).map((s) => s.id)
  let visitCounts: Record<string, number> = {}

  if (saleIds.length > 0) {
    const { data: visits } = await supabase
      .from('visit_intents')
      .select('sale_id, state')
      .in('sale_id', saleIds)
      .eq('state', 'confirmed')

    for (const v of visits ?? []) {
      visitCounts[v.sale_id] = (visitCounts[v.sale_id] ?? 0) + 1
    }
  }

  return <SalesClient sales={sales ?? []} visitCounts={visitCounts} />
}
