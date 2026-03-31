import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

export default async function DashboardPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  return (
    <main className="min-h-screen bg-night px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-surface">
            Welcome, {user.firstName ?? 'Chef'} 👋
          </h1>
          <UserButton
            appearance={{
              variables: { colorPrimary: '#F7941D' },
            }}
            afterSignOutUrl="/"
          />
        </header>
        <p className="mt-4 text-surface/70">
          Your SerendipEatery business dashboard is coming soon.
        </p>
      </div>
    </main>
  )
}
