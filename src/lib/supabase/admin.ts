import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec la clé service_role — BYPASSE la RLS.
 * À n'utiliser QUE côté serveur, pour des opérations privilégiées (jamais exposé au client).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
