import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createCheckoutSession, type PlanId } from '@/lib/stripe'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { businessId, plan, email } = body as {
    businessId: string
    plan: PlanId
    email: string
  }

  if (!businessId || !plan || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const validPlans: PlanId[] = ['starter', 'growth', 'pro']
  if (!validPlans.includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  try {
    const origin = new URL(request.url).origin
    const url = await createCheckoutSession(businessId, plan, email, origin)
    return NextResponse.json({ url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
