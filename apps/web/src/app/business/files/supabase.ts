// apps/api/src/lib/supabase.ts
// Supabase client for the Fastify API server (service role — bypasses RLS)

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
  );
}

/**
 * Service-role client — full DB access, bypasses RLS.
 * Use only in the API server, never in client-side code.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Returns a Supabase client with a Clerk user's ID set as a session variable.
 * This enables RLS policies that check `current_setting('app.clerk_id')`.
 */
export function supabaseForUser(clerkId: string): SupabaseClient {
  return createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        'x-clerk-user-id': clerkId,
      },
    },
    db: {
      schema: 'public',
    },
  });
}

/**
 * PostGIS helper — build a ST_SetSRID(ST_MakePoint(...)) expression string
 * for use in raw SQL queries.
 */
export function makePoint(lng: number, lat: number): string {
  return `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
}

/**
 * Check if a user's location is within a flash sale geofence.
 * Calls the server-side SQL function user_inside_fence().
 */
export async function checkInsideFence(
  flashSaleId: string,
  userLat: number,
  userLng: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc('user_inside_fence', {
    p_flash_sale_id: flashSaleId,
    user_lat: userLat,
    user_lng: userLng,
  });

  if (error) throw error;
  return data as boolean;
}

/**
 * Find all active flash sales within radius of a coordinate.
 */
export async function activeSalesNear(
  lat: number,
  lng: number,
  radiusKm = 5
): Promise<Array<{ sale_id: string; business_id: string; business_name: string; distance_m: number }>> {
  const { data, error } = await supabase.rpc('active_sales_near', {
    lat,
    lng,
    radius_km: radiusKm,
  });

  if (error) throw error;
  return data ?? [];
}
