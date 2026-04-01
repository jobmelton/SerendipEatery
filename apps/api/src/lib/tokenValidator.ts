import { supabase } from './supabase.js'
import { AppError } from './errors.js'

const EXPO_TOKEN_RE = /^ExponentPushToken\[[a-zA-Z0-9_-]+\]$/

/**
 * Validate that a token is a properly formatted Expo push token.
 */
export function validatePushToken(token: string): boolean {
  if (typeof token !== 'string') return false
  return EXPO_TOKEN_RE.test(token)
}

/**
 * Validate and store a push token, ensuring it belongs to the requesting user.
 * Prevents one user from registering another user's token.
 */
export async function ensureTokenOwnership(
  token: string,
  userId: string,
): Promise<void> {
  if (!validatePushToken(token)) {
    throw new AppError(400, 'INVALID_TOKEN', 'Invalid Expo push token format')
  }

  // Check if this token is already registered to a different user
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('expo_push_token', token)
    .neq('id', userId)
    .single()

  if (existing) {
    // Token belongs to another user — clear it from them before reassigning
    await supabase
      .from('users')
      .update({ expo_push_token: null })
      .eq('id', existing.id)
  }

  // Store the token for this user
  await supabase
    .from('users')
    .update({ expo_push_token: token })
    .eq('id', userId)
}
