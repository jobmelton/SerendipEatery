import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

export async function POST(request: Request) {
  const { email } = await request.json()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  // Try insert; if table doesn't exist, create it first
  let { error } = await supabase.from('waitlist').upsert(
    { email: email.toLowerCase().trim() },
    { onConflict: 'email' },
  )

  if (error?.code === '42P01') {
    // Table doesn't exist — create it via raw SQL
    await supabase.rpc('exec_sql', {
      query: `CREATE TABLE IF NOT EXISTS waitlist (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        email text NOT NULL UNIQUE,
        created_at timestamptz DEFAULT now()
      ); ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;`,
    }).catch(() => {
      // RPC may not exist; table must be created via migration
    })

    // Retry the insert
    const retry = await supabase.from('waitlist').upsert(
      { email: email.toLowerCase().trim() },
      { onConflict: 'email' },
    )
    error = retry.error
  }

  if (error) {
    return NextResponse.json({ error: 'Failed to save — please try again later' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
