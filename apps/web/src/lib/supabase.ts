import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../packages/engine/src/database.types.ts';

/** Browser client. The URL and anon key are public by design (docs/PLAN.md Appendix A9). */
export type Client = SupabaseClient<Database>;

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when the build has no Supabase settings (the page then says what is missing). */
export const supabase: Client | null = url && anonKey ? createClient<Database>(url, anonKey) : null;

export const supabaseUrl = url ?? '';
export const supabaseAnonKey = anonKey ?? '';
