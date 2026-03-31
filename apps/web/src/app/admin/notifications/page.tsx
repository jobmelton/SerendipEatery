import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

export default async function AdminNotificationsPage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [totalRes, todayRes, recentRes] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).gte('sent_at', today.toISOString()),
    supabase.from('notifications').select('*').order('sent_at', { ascending: false }).limit(20),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-surface mb-6">Notification Worker</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#1a1230] rounded-xl p-4">
          <p className="text-2xl font-extrabold text-surface">{totalRes.count ?? 0}</p>
          <p className="text-surface/50 text-xs mt-1">Total Sent</p>
        </div>
        <div className="bg-[#1a1230] rounded-xl p-4">
          <p className="text-2xl font-extrabold text-surface">{todayRes.count ?? 0}</p>
          <p className="text-surface/50 text-xs mt-1">Sent Today</p>
        </div>
        <div className="bg-[#1a1230] rounded-xl p-4">
          <p className="text-2xl font-extrabold text-teal">0</p>
          <p className="text-surface/50 text-xs mt-1">Queue Depth</p>
        </div>
        <div className="bg-[#1a1230] rounded-xl p-4">
          <p className="text-2xl font-extrabold text-teal">0</p>
          <p className="text-surface/50 text-xs mt-1">Failed Jobs</p>
        </div>
      </div>

      <section className="bg-[#1a1230] rounded-2xl p-6">
        <h2 className="text-lg font-bold text-surface mb-4">Recent Notifications</h2>
        {(recentRes.data ?? []).length === 0 ? (
          <p className="text-surface/40 text-sm">No notifications sent yet</p>
        ) : (
          <div className="space-y-2">
            {(recentRes.data ?? []).map((notif: any) => (
              <div key={notif.id} className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <p className="text-surface text-sm font-medium">{notif.title}</p>
                  <p className="text-surface/40 text-xs">{notif.body}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-btc px-2 py-0.5 bg-btc/10 rounded">{notif.type}</span>
                  <p className="text-surface/30 text-xs mt-1">
                    {new Date(notif.sent_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
