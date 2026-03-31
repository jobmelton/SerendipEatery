import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { BillingClient } from './billing-client'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

export default async function BillingPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  // Get the user's business
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .limit(1)
    .single()

  // Get billing events this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  let monthlyUsage = { confirmedVisits: 0, influencedVisits: 0, totalChargeCents: 0 }

  if (business) {
    const { data: events } = await supabase
      .from('billing_events')
      .select('type, amount_cents')
      .eq('business_id', business.id)
      .gte('created_at', startOfMonth.toISOString())

    if (events) {
      monthlyUsage = {
        confirmedVisits: events.filter((e) => e.type === 'confirmed_visit').length,
        influencedVisits: events.filter((e) => e.type === 'influenced_visit').length,
        totalChargeCents: events.reduce((sum, e) => sum + (e.amount_cents ?? 0), 0),
      }
    }
  }

  return (
    <BillingClient
      business={business}
      monthlyUsage={monthlyUsage}
      userEmail={user.emailAddresses[0]?.emailAddress ?? ''}
    />
  )
}
