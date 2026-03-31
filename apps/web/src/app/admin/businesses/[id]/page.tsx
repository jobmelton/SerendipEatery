import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { BusinessDetailClient } from './business-detail-client'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', id)
    .single()

  if (!business) redirect('/admin/businesses')

  // Evidence progress
  const { data: evidenceData } = await supabase.rpc('get_evidence_progress', {
    p_business_id: id,
  })

  // Billing history
  const { data: billingEvents } = await supabase
    .from('billing_events')
    .select('*')
    .eq('business_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Sales count
  const { count: totalSales } = await supabase
    .from('flash_sales')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', id)

  const { count: confirmedVisits } = await supabase
    .from('visit_intents')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', id)
    .eq('state', 'confirmed')

  return (
    <BusinessDetailClient
      business={business}
      evidence={evidenceData?.[0] ?? null}
      billingEvents={billingEvents ?? []}
      totalSales={totalSales ?? 0}
      confirmedVisits={confirmedVisits ?? 0}
    />
  )
}
