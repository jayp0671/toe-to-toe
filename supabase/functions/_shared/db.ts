import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../packages/engine/src/database.types.ts';

/** Service-role client: Edge Functions are the only writers of Health totals (golden rule 5). */
export type Db = SupabaseClient<Database>;

export function serviceClient(url: string, serviceRoleKey: string): Db {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** The service client for a deployed or served function (the runtime provides both variables). */
export function serviceClientFromEnv(): Db {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  return serviceClient(url, key);
}
