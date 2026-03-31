// apps/api/src/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function supabaseForUser(clerkId: string): SupabaseClient {
  return createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-clerk-user-id': clerkId } },
  });
}

export function makePoint(lng: number, lat: number): string {
  return `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
}

export async function checkInsideFence(flashSaleId: string, userLat: number, userLng: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('user_inside_fence', {
    p_flash_sale_id: flashSaleId, user_lat: userLat, user_lng: userLng,
  });
  if (error) throw error;
  return data as boolean;
}

export async function activeSalesNear(lat: number, lng: number, radiusKm = 5) {
  const { data, error } = await supabase.rpc('active_sales_near', { lat, lng, radius_km: radiusKm });
  if (error) throw error;
  return data ?? [];
}
