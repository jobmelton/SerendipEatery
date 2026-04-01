import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { validate } from '../lib/validate'
import { AppError } from '../lib/errors'
import { AuthenticatedRequest } from '../middleware/auth'
import { generateReferralCode, redeemReferral, getReferralStats } from '../lib/referrals'

const redeemSchema = z.object({
  code: z.string().min(3).max(20),
})

export async function referralRoutes(app: FastifyInstance) {
  // GET /referrals/my-code — get user's referral codes
  app.get('/referrals/my-code', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth

    // Fetch user's existing referral codes
    const { data: existing } = await supabase
      .from('referrals')
      .select('code, type, status')
      .eq('referrer_id', userId)
      .eq('referrer_type', 'user')

    // Fetch user info for code generation
    const { data: user } = await supabase
      .from('users')
      .select('display_name, referral_code, referral_code_biz')
      .eq('id', userId)
      .single()

    // If user doesn't have codes yet, generate and store them
    if (user && !user.referral_code) {
      const name = user.display_name ?? 'USER'
      const userCode = generateReferralCode(name, 'user_to_user')
      const bizCode = generateReferralCode(name, 'user_to_biz')

      await supabase
        .from('users')
        .update({ referral_code: userCode, referral_code_biz: bizCode })
        .eq('id', userId)

      // Create pending referral entries
      await supabase.from('referrals').insert([
        {
          code: userCode,
          referrer_id: userId,
          referrer_type: 'user',
          type: 'user_to_user',
          status: 'pending',
          referrer_pts: 0,
          referee_pts: 0,
        },
        {
          code: bizCode,
          referrer_id: userId,
          referrer_type: 'user',
          type: 'user_to_biz',
          status: 'pending',
          referrer_pts: 0,
          referee_pts: 0,
        },
      ])

      return {
        ok: true,
        data: {
          userCode,
          bizCode,
          referrals: [],
        },
      }
    }

    return {
      ok: true,
      data: {
        userCode: user?.referral_code ?? null,
        bizCode: user?.referral_code_biz ?? null,
        referrals: existing ?? [],
      },
    }
  })

  // POST /referrals/redeem — redeem a referral code
  app.post('/referrals/redeem', {
    preHandler: validate(redeemSchema),
  }, async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { code } = request.body as z.infer<typeof redeemSchema>

    const result = await redeemReferral(code, userId)

    return {
      ok: true,
      data: {
        type: result.type,
        referrerPointsAwarded: result.rewards.referrerPoints,
        receiverPointsAwarded: result.rewards.receiverPoints,
        specialRewards: [
          result.rewards.referrerSpecial,
          result.rewards.receiverSpecial,
        ].filter(Boolean),
      },
    }
  })

  // GET /referrals/stats — referral performance stats
  app.get('/referrals/stats', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const stats = await getReferralStats(userId)
    return { ok: true, data: stats }
  })
}
