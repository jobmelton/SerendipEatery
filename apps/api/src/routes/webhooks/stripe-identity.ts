import { FastifyInstance } from 'fastify'
import Stripe from 'stripe'
import { supabase } from '../../lib/supabase.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-02-24.acacia' as any,
})

/**
 * Stripe Identity webhook — public route (no auth).
 * Configure in Stripe Dashboard → Webhooks:
 *   URL: https://api-production-7cc7.up.railway.app/webhooks/stripe-identity
 *   Events: identity.verification_session.verified,
 *           identity.verification_session.requires_input,
 *           identity.verification_session.canceled
 */
export async function stripeIdentityWebhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/stripe-identity', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string
    const webhookSecret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(
        (request as any).rawBody || JSON.stringify(request.body),
        sig,
        webhookSecret ?? '',
      )
    } catch {
      return reply.code(400).send({ error: 'Invalid signature' })
    }

    const session = event.data.object as any

    if (event.type === 'identity.verification_session.verified') {
      await supabase.from('businesses').update({
        verification_status: 'verified',
        verified_at: new Date().toISOString(),
        rejection_reason: null,
      }).eq('stripe_identity_session_id', session.id)
    } else if (event.type === 'identity.verification_session.requires_input') {
      await supabase.from('businesses').update({
        verification_status: 'pending',
      }).eq('stripe_identity_session_id', session.id)
    } else if (event.type === 'identity.verification_session.canceled') {
      await supabase.from('businesses').update({
        verification_status: 'rejected',
        rejection_reason: session.last_error?.reason ?? 'Verification canceled',
      }).eq('stripe_identity_session_id', session.id)
    }

    return { received: true }
  })
}
