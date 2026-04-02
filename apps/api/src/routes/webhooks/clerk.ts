import { FastifyInstance } from 'fastify'
import { supabase } from '../../lib/supabase.js'

/**
 * Clerk webhook handler — processes user.created and user.updated events.
 * Extracts OAuth provider, social username, and avatar from Clerk's external accounts.
 *
 * Webhook should be configured in Clerk Dashboard → Webhooks pointing to:
 *   POST /webhooks/clerk
 */

// Provider display names and how to extract username
const PROVIDER_MAP: Record<string, { label: string; extractUsername: (account: any) => string | null }> = {
  oauth_google:    { label: 'google',    extractUsername: (a) => a.email_address },
  oauth_apple:     { label: 'apple',     extractUsername: (a) => a.email_address },
  oauth_facebook:  { label: 'facebook',  extractUsername: (a) => a.username || a.first_name },
  oauth_instagram: { label: 'instagram', extractUsername: (a) => a.username ? `@${a.username}` : null },
  oauth_tiktok:    { label: 'tiktok',    extractUsername: (a) => a.username ? `@${a.username}` : null },
  oauth_x:         { label: 'twitter',   extractUsername: (a) => a.username ? `@${a.username}` : null },
  oauth_twitter:   { label: 'twitter',   extractUsername: (a) => a.username ? `@${a.username}` : null },
  oauth_snapchat:  { label: 'snapchat',  extractUsername: (a) => a.username },
  oauth_discord:   { label: 'discord',   extractUsername: (a) => a.username },
  oauth_spotify:   { label: 'spotify',   extractUsername: (a) => a.username },
  oauth_github:    { label: 'github',    extractUsername: (a) => a.username ? `@${a.username}` : null },
  oauth_linkedin:  { label: 'linkedin',  extractUsername: (a) => `${a.first_name} ${a.last_name}`.trim() || null },
}

function extractSocialProfile(externalAccounts: any[]) {
  if (!externalAccounts?.length) return null

  // Use the first (primary) external account
  const account = externalAccounts[0]
  const provider = account.provider || account.verification?.strategy
  const mapped = PROVIDER_MAP[provider]

  return {
    auth_provider: mapped?.label ?? provider ?? 'email',
    social_username: mapped?.extractUsername(account) ?? null,
    social_avatar_url: account.avatar_url || account.image_url || null,
    social_profile_url: account.public_metadata?.profile_url ?? null,
  }
}

export async function clerkWebhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/clerk', async (request, reply) => {
    // Clerk sends webhook events as JSON with type + data
    const body = request.body as any

    // Basic verification — in production, verify the Svix signature
    // https://clerk.com/docs/webhooks/sync-data
    const eventType = body?.type
    const userData = body?.data

    if (!eventType || !userData) {
      return reply.code(400).send({ error: 'Invalid webhook payload' })
    }

    if (eventType === 'user.created' || eventType === 'user.updated') {
      const clerkId = userData.id
      const email = userData.email_addresses?.[0]?.email_address ?? null
      const displayName = [userData.first_name, userData.last_name].filter(Boolean).join(' ') || null
      const imageUrl = userData.image_url || userData.profile_image_url || null

      // Extract social profile from external accounts
      const social = extractSocialProfile(userData.external_accounts)

      if (eventType === 'user.created') {
        // Insert new user
        await supabase.from('users').upsert({
          clerk_id: clerkId,
          email,
          display_name: displayName,
          auth_provider: social?.auth_provider ?? 'email',
          social_username: social?.social_username,
          social_avatar_url: social?.social_avatar_url ?? imageUrl,
          social_profile_url: social?.social_profile_url,
        }, { onConflict: 'clerk_id' })
      } else {
        // Update existing user — only update social fields if they changed
        const update: Record<string, any> = {}
        if (displayName) update.display_name = displayName
        if (email) update.email = email
        if (social?.auth_provider) update.auth_provider = social.auth_provider
        if (social?.social_username) update.social_username = social.social_username
        if (social?.social_avatar_url || imageUrl) {
          update.social_avatar_url = social?.social_avatar_url ?? imageUrl
        }
        if (social?.social_profile_url) update.social_profile_url = social.social_profile_url

        if (Object.keys(update).length > 0) {
          await supabase.from('users').update(update).eq('clerk_id', clerkId)
        }
      }
    }

    return { received: true }
  })
}
