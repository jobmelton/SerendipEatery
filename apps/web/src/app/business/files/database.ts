// packages/shared/src/types/database.ts
// Auto-aligned with Supabase schema — update after any migration

// ============================================================
// ENUMS
// ============================================================

export type VisitState =
  | 'spun_away'
  | 'inside_fence'
  | 'confirmed'
  | 'expired'
  | 'influenced'
  | 'passive';

export type SaleStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';

export type NotificationType =
  | 'sale_live'
  | 'ending_soon'
  | 'you_won'
  | 'winner_reminder'
  | 'visit_confirmed'
  | 'truck_moved'
  | 'new_sale_nearby';

export type BusinessType = 'restaurant' | 'food_truck';

export type BillingPlan = 'trial' | 'starter' | 'growth' | 'pro';

export type ReferralPath = 'user_user' | 'user_biz' | 'biz_customer' | 'biz_biz';

export type LoyaltyTier =
  | 'explorer'
  | 'regular'
  | 'local_legend'
  | 'foodie_royale'
  | 'tastemaker'
  | 'influencer'
  | 'food_legend'
  | 'icon';

export type BusinessTier =
  | 'operator'
  | 'hustler'
  | 'grinder'
  | 'vendor'
  | 'business_owner'
  | 'empire';

// ============================================================
// LOYALTY CONFIG (source of truth)
// ============================================================

export interface LoyaltyTierConfig {
  tier: LoyaltyTier;
  minPoints: number;
  maxPoints: number | null;
  boostPct: number;
  revenueSharePct: number;
  perks: string[];
}

export const LOYALTY_TIERS: LoyaltyTierConfig[] = [
  { tier: 'explorer',      minPoints: 0,      maxPoints: 499,   boostPct: 0,  revenueSharePct: 0,  perks: [] },
  { tier: 'regular',       minPoints: 500,    maxPoints: 1499,  boostPct: 5,  revenueSharePct: 0,  perks: [] },
  { tier: 'local_legend',  minPoints: 1500,   maxPoints: 3999,  boostPct: 12, revenueSharePct: 0,  perks: [] },
  { tier: 'foodie_royale', minPoints: 4000,   maxPoints: 9999,  boostPct: 20, revenueSharePct: 0,  perks: [] },
  { tier: 'tastemaker',    minPoints: 10000,  maxPoints: 24999, boostPct: 30, revenueSharePct: 0,  perks: [] },
  { tier: 'influencer',    minPoints: 25000,  maxPoints: 59999, boostPct: 40, revenueSharePct: 2,  perks: ['2% revenue share'] },
  { tier: 'food_legend',   minPoints: 60000,  maxPoints: 149999,boostPct: 50, revenueSharePct: 5,  perks: ['5% revenue share', 'co-brand'] },
  { tier: 'icon',          minPoints: 150000, maxPoints: null,  boostPct: 65, revenueSharePct: 10, perks: ['10% revenue share', 'free Pro', 'co-brand'] },
];

// ============================================================
// DATABASE ROW TYPES
// ============================================================

export interface User {
  id: string;
  clerk_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  expo_push_token: string | null;
  fcm_token: string | null;
  apns_token: string | null;
  consumer_points: number;
  loyalty_tier: LoyaltyTier;
  revenue_share_pct: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  max_daily_notifs: number;
  notification_radius_km: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  clerk_org_id: string | null;
  owner_clerk_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  cuisine_tags: string[];
  phone: string | null;
  website: string | null;
  business_type: BusinessType;
  address: string | null;
  location: GeoPoint | null;
  billing_plan: BillingPlan;
  stripe_customer_id: string | null;
  stripe_sub_id: string | null;
  billing_cap_cents: number | null;
  plan_started_at: string | null;
  plan_ends_at: string | null;
  business_points: number;
  business_tier: BusinessTier;
  trial_referral_visits: number;
  trial_biz_referrals: number;
  trial_total_sales: number;
  trial_conversion_rate: number;
  trial_repeat_customers: number;
  trial_locked: boolean;
  trial_locked_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FlashSale {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  status: SaleStatus;
  starts_at: string;
  ends_at: string;
  spin_window_mins: number;
  fence_center: GeoPoint;
  fence_radius_m: number;
  total_spins: number;
  confirmed_visits: number;
  influenced_visits: number;
  created_at: string;
  updated_at: string;
}

export interface Prize {
  id: string;
  flash_sale_id: string;
  label: string;
  description: string | null;
  emoji: string | null;
  image_url: string | null;
  weight: number;
  max_spins: number;
  spins_used: number;
  is_ghost: boolean;
  base_weight: number;
  created_at: string;
}

export interface VisitIntent {
  id: string;
  user_id: string;
  flash_sale_id: string;
  prize_id: string | null;
  state: VisitState;
  spun_at: string | null;
  spin_location: GeoPoint | null;
  arrived_at: string | null;
  arrival_location: GeoPoint | null;
  confirmed_at: string | null;
  expired_at: string | null;
  spin_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingEvent {
  id: string;
  business_id: string;
  visit_intent_id: string | null;
  flash_sale_id: string | null;
  event_type: string;
  amount_cents: number;
  stripe_event_id: string | null;
  billed_at: string;
  created_at: string;
}

export interface GeofenceSnapshot {
  id: string;
  flash_sale_id: string;
  business_id: string;
  center: GeoPoint;
  radius_m: number;
  recorded_at: string;
}

export interface TruckLocationPing {
  id: string;
  business_id: string;
  flash_sale_id: string | null;
  location: GeoPoint;
  accuracy_m: number | null;
  pinged_at: string;
}

export interface Referral {
  id: string;
  code: string;
  path: ReferralPath;
  referrer_user_id: string | null;
  referrer_biz_id: string | null;
  receiver_user_id: string | null;
  receiver_biz_id: string | null;
  referrer_rewarded: boolean;
  receiver_rewarded: boolean;
  trigger_event: string | null;
  triggered_at: string | null;
  created_at: string;
}

export interface PointTransaction {
  id: string;
  user_id: string | null;
  business_id: string | null;
  points: number;
  reason: string;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  flash_sale_id: string | null;
  business_id: string | null;
  sent_at: string | null;
  read_at: string | null;
  failed: boolean;
  failure_reason: string | null;
  dedup_key: string | null;
  created_at: string;
}

// ============================================================
// GEO TYPES
// ============================================================

/** PostGIS returns GeoJSON Point objects */
export interface GeoPoint {
  type: 'Point';
  coordinates: [longitude: number, latitude: number];
}

export interface LatLng {
  lat: number;
  lng: number;
}

export function geoPointToLatLng(point: GeoPoint): LatLng {
  return { lat: point.coordinates[1], lng: point.coordinates[0] };
}

export function latLngToGeoPoint(ll: LatLng): GeoPoint {
  return { type: 'Point', coordinates: [ll.lng, ll.lat] };
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: {
    code: string;
    message: string;
    statusCode: number;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// ============================================================
// SPIN WHEEL TYPES
// ============================================================

export interface SpinRequest {
  flash_sale_id: string;
  user_lat: number;
  user_lng: number;
}

export interface SpinResult {
  visit_intent_id: string;
  prize: Prize;
  state: VisitState;
  spin_expires_at: string;
  loyalty_boost_applied: number;
}

// ============================================================
// BILLING CONFIG (source of truth)
// ============================================================

export interface BillingPlanConfig {
  plan: BillingPlan;
  monthly_cents: number;
  per_visit_cents: number;
  per_influenced_cents: number;
  monthly_cap_cents: number | null;
  resubscription_cents: number | null;
}

export const BILLING_PLANS: BillingPlanConfig[] = [
  {
    plan: 'trial',
    monthly_cents: 0,
    per_visit_cents: 0,
    per_influenced_cents: 0,
    monthly_cap_cents: null,
    resubscription_cents: null,
  },
  {
    plan: 'starter',
    monthly_cents: 2900,
    per_visit_cents: 150,
    per_influenced_cents: 0,
    monthly_cap_cents: 15000,
    resubscription_cents: 3900,
  },
  {
    plan: 'growth',
    monthly_cents: 7900,
    per_visit_cents: 100,
    per_influenced_cents: 25,
    monthly_cap_cents: 30000,
    resubscription_cents: 8900,
  },
  {
    plan: 'pro',
    monthly_cents: 9900,
    per_visit_cents: 0,
    per_influenced_cents: 0,
    monthly_cap_cents: null,
    resubscription_cents: null,
  },
];

// ============================================================
// TRIAL EVIDENCE THRESHOLDS
// ============================================================

export const TRIAL_THRESHOLDS = {
  referral_visits: 10,
  biz_referrals: 3,
  total_sales: 5,
  conversion_rate: 0.15,   // 15%
  repeat_customers: 5,
} as const;
