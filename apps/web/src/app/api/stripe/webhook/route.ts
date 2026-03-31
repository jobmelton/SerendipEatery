import { NextResponse } from 'next/server'
import { stripe, handleWebhook } from '@/lib/stripe'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    await handleWebhook(event)
  } catch (err: any) {
    console.error('Webhook handler error:', err.message)
    // Return 200 anyway to prevent Stripe retries for handler errors
  }

  return NextResponse.json({ received: true })
}
