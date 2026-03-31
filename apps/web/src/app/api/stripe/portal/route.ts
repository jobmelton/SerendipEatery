import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createCustomerPortalSession } from '@/lib/stripe'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { customerId } = body as { customerId: string }

  if (!customerId) {
    return NextResponse.json({ error: 'Missing customerId' }, { status: 400 })
  }

  try {
    const origin = new URL(request.url).origin
    const url = await createCustomerPortalSession(customerId, origin)
    return NextResponse.json({ url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
