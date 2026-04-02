// ─── Visit State Machine ───────────────────────────────────────────────────

export type VisitState =
  | 'spun_away'      // user spun outside fence, awaiting arrival (60-min window)
  | 'inside_fence'   // user entered 10m geofence, awaiting spin
  | 'confirmed'      // both conditions met → billing event created
  | 'expired'        // 60-min window elapsed without arrival
  | 'influenced'     // arrived within 90 min post-sale
  | 'passive'        // notification only, walked in within 30 min post-sale

export interface VisitIntent {
  id: string
  userId: string
  saleId: string
  businessId: string
  state: VisitState
  prizeWon: string | null
  prizeCode: string | null
  spinLat: number | null
  spinLng: number | null
  spunAt: Date | null
  enteredFenceAt: Date | null
  confirmedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
}

// ─── Business ─────────────────────────────────────────────────────────────

export type BusinessType = 'truck' | 'restaurant' | 'popup' | 'market'
export type SubscriptionPlan = 'trial' | 'starter' | 'growth' | 'pro'
export type BusinessTier =
  | 'operator' | 'hustler' | 'grinder' | 'vendor' | 'business_owner' | 'empire'

export interface Business {
  id: string
  ownerId: string
  name: string
  type: BusinessType
  cuisine: string
  addressLine: string
  lat: number
  lng: number
  plan: SubscriptionPlan
  bizPoints: number
  bizTier: BusinessTier
  referralCode: string
  trialEvidenceScore: number // 0-5 thresholds met
  subscriptionEndsAt: Date | null
  createdAt: Date
}

// ─── Flash Sale ────────────────────────────────────────────────────────────

export type SaleStatus = 'scheduled' | 'live' | 'ended' | 'cancelled'

export interface FlashSale {
  id: string
  businessId: string
  status: SaleStatus
  startsAt: Date
  endsAt: Date
  radiusM: number          // notification blast radius in meters
  maxSpinsTotal: number
  spinsUsed: number
  prizes: Prize[]
  createdAt: Date
}

export interface Prize {
  id: string
  saleId: string
  name: string
  type: 'percent' | 'amount' | 'free' | 'free_with'
  value: number            // e.g. 20 for 20% off, 4.50 for $4.50 off
  maxSpins: number         // hard cap — never exceeded even with loyalty boost
  spinsUsed: number
  arrivalRate: number      // calculated after sale ends
}

// ─── User ─────────────────────────────────────────────────────────────────

export type ConsumerTier =
  | 'explorer' | 'regular' | 'local_legend' | 'foodie_royale'
  | 'tastemaker' | 'influencer' | 'food_legend' | 'icon'

export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  points: number
  consumerTier: ConsumerTier
  referralCode: string        // e.g. MAYA-U42
  referralCodeBiz: string     // e.g. MAYA-BIZ
  linkedBusinessId: string | null  // set if user also owns a business
  streakDays: number
  lastVisitAt: Date | null
  createdAt: Date
}

// ─── Notification ─────────────────────────────────────────────────────────

export type NotifType =
  | 'sale_live'
  | 'ending_soon'
  | 'you_won'
  | 'winner_reminder'
  | 'visit_confirmed'
  | 'truck_moved'
  | 'new_sale_nearby'

export interface NotifJob {
  type: NotifType
  userId: string
  saleId: string
  businessId: string
  payload: Record<string, string | number>
  scheduleAt?: Date        // for delayed jobs (winner_reminder)
}

// ─── Geofence ─────────────────────────────────────────────────────────────

export interface GeofenceSnapshot {
  id: string
  saleId: string
  businessId: string
  lat: number
  lng: number
  radiusM: number          // always 10 for check-in fence
  createdAt: Date
}

// ─── Billing ──────────────────────────────────────────────────────────────

export type BillingEventType = 'confirmed_visit' | 'influenced_visit' | 'subscription'

export interface BillingEvent {
  id: string
  businessId: string
  visitIntentId: string | null
  type: BillingEventType
  amountCents: number
  stripeEventId: string | null
  createdAt: Date
}

// ─── Referral ─────────────────────────────────────────────────────────────

export type ReferralType = 'user_to_user' | 'user_to_biz' | 'biz_to_customer' | 'biz_to_biz'

export interface Referral {
  id: string
  code: string
  referrerId: string
  referrerType: 'user' | 'business'
  refereeId: string | null
  refereeType: 'user' | 'business' | null
  type: ReferralType
  status: 'pending' | 'rewarded' | 'expired'
  referrerPts: number
  refereePts: number
  rewardedAt: Date | null
  createdAt: Date
}

// ─── Loyalty Points ────────────────────────────────────────────────────────

export type EarnAction =
  | 'spin'
  | 'confirmed_visit'
  | 'rating'
  | 'return_visit'
  | 'referral_friend'
  | 'referral_business'
  | 'discovery_spin'
  | 'streak_7day'
  | 'streak_30day'
  | 'first_visit_new_restaurant'
  | 'visit_100_milestone'
  | 'share_converts'
  | 'drop_challenge'
  | 'challenge_accepted'
  | 'battle_win'
  | 'battle_loss'
  | 'battle_forfeit_win'

export const EARN_POINTS: Record<EarnAction, number> = {
  spin: 10,
  confirmed_visit: 50,
  rating: 20,
  return_visit: 30,
  referral_friend: 100,
  referral_business: 500,
  discovery_spin: 5,
  streak_7day: 150,
  streak_30day: 500,
  first_visit_new_restaurant: 75,
  visit_100_milestone: 1000,
  share_converts: 50,
  drop_challenge: 15,
  challenge_accepted: 10,
  battle_win: 25,
  battle_loss: 5,
  battle_forfeit_win: 10,
}

export const CONSUMER_TIER_THRESHOLDS: Record<ConsumerTier, number> = {
  explorer: 0,
  regular: 500,
  local_legend: 1500,
  foodie_royale: 4000,
  tastemaker: 10000,
  influencer: 25000,
  food_legend: 60000,
  icon: 150000,
}

export const TIER_BOOST_PCT: Record<ConsumerTier, number> = {
  explorer: 0,
  regular: 5,
  local_legend: 12,
  foodie_royale: 20,
  tastemaker: 30,
  influencer: 40,
  food_legend: 50,
  icon: 65,
}

// ─── Auth Types ───────────────────────────────────────────────────────────

export type LoyaltyTier = ConsumerTier | BusinessTier
export type BillingPlan = SubscriptionPlan

export interface ClerkAuthPayload {
  sub: string
  email: string
  firstName: string | null
  lastName: string | null
  imageUrl: string | null
  metadata: Record<string, unknown>
}

export interface AuthenticatedUser {
  clerkId: string
  email: string
  displayName: string
  avatarUrl: string | null
  consumerTier: ConsumerTier
  points: number
}

export interface AuthenticatedBusiness {
  clerkId: string
  email: string
  businessId: string
  businessName: string
  businessTier: BusinessTier
  plan: SubscriptionPlan
}

// ─── API Response Shapes ───────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  error: string
  code: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── Spin Engine ───────────────────────────────────────────────────────────

export interface SpinRequest {
  saleId: string
  userId: string
  spinLat: number
  spinLng: number
}

export interface SpinResult {
  prizeId: string
  prizeName: string
  prizeType: Prize['type']
  prizeValue: number
  code: string
  expiresAt: Date
  pointsEarned: number
  visitIntentId: string
}

// ─── Evidence Thresholds (trial system) ────────────────────────────────────

export interface EvidenceStatus {
  refVisits: number        // target: 5
  refBusinesses: number    // target: 3
  totalSales: number       // target: 10
  conversionRate: number   // target: 25%
  repeatCustomers: number  // target: 1
  thresholdsMet: number    // 0-5
  allMet: boolean
}
