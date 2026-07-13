import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase côté navigateur (clé anon, publique). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
