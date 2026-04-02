import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ProfileClient } from './profile-client'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

export default async function ProfilePage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  // Get user record
  const { data: profile } = await supabase
    .from('users')
    .select('clerk_id, display_name, email, consumer_points, loyalty_tier, revenue_share_pct, auth_provider, social_username, social_avatar_url, battle_tagline, created_at')
    .eq('clerk_id', user.id)
    .limit(1)
    .single()

  // Get referral code
  const { data: referral } = await supabase
    .from('referrals')
    .select('code')
    .eq('referrer_user_id', profile?.clerk_id ?? user.id)
    .eq('path', 'user_user')
    .limit(1)
    .single()

  // Recent point transactions (visit_intents as proxy — confirmed visits = points)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentVisits } = await supabase
    .from('visit_intents')
    .select('id, state, prize_name, business_name, points_earned, created_at')
    .eq('user_id', user.id)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <ProfileClient
      user={{
        firstName: user.firstName ?? 'Explorer',
        imageUrl: user.imageUrl,
      }}
      profile={profile ?? {
        consumer_points: 0,
        loyalty_tier: 'explorer',
        revenue_share_pct: 0,
        auth_provider: null,
        social_username: null,
        social_avatar_url: null,
        battle_tagline: null,
      }}
      referralCode={referral?.code ?? null}
      recentActivity={recentVisits ?? []}
    />
  )
}
