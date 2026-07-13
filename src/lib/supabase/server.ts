import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase côté serveur, lié à la session de l'utilisateur via cookies.
 * Toutes les requêtes passent par RLS (isolation par établissement).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll appelé depuis un Server Component : ignoré (le middleware rafraîchit la session).
          }
        },
      },
    }
  );
}
