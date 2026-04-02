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

  const { error } = await supabase.from('waitlist').upsert(
    { email: email.toLowerCase().trim() },
    { onConflict: 'email' },
  )

  if (error) {
    return NextResponse.json({ error: 'Failed to save — please try again later' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
