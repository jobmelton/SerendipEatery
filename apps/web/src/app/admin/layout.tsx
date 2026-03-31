import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean)

const navItems = [
  { href: '/admin', label: 'Overview', icon: '📊' },
  { href: '/admin/businesses', label: 'Businesses', icon: '🏪' },
  { href: '/admin/sales', label: 'Sales', icon: '🎰' },
  { href: '/admin/notifications', label: 'Notifications', icon: '🔔' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()

  if (!user || !ADMIN_USER_IDS.includes(user.id)) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-night flex">
      {/* Sidebar */}
      <aside className="w-56 bg-[#1a1230] border-r border-white/5 p-4 flex flex-col">
        <Link href="/admin" className="text-btc font-extrabold text-lg mb-6">
          Admin
        </Link>
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-surface/70 hover:text-surface hover:bg-white/5 transition text-sm"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/5 pt-4 mt-4">
          <Link href="/dashboard" className="text-surface/40 text-xs hover:text-surface/70 transition">
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
