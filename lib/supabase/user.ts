import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-request cookie-bound Supabase client.
 * Respects RLS — operations scoped to the authenticated user.
 * Returns null when env vars are missing.
 */
export async function getSupabaseUser(): Promise<SupabaseClient | null> {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options: CookieOptions;
        }>,
      ) {
        for (const { name, value, options } of cookiesToSet) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // setAll may be called from a Server Component where cookies
            // are read-only. Swallow the error — the middleware will
            // refresh the session cookie on the next request.
          }
        }
      },
    },
  });
}

/**
 * Get the current authenticated user's ID.
 * Returns null if Supabase is not configured or user is not authenticated.
 * NOTE: includes anonymous Supabase sessions (which Layers auto-creates) —
 * use `getCurrentSignedInUserId()` for "is this a real, email-bound user?".
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await getSupabaseUser();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Get the current SIGNED-IN user's ID — i.e. one with a real email/OAuth
 * identity, not an auto-issued anonymous session. Auth guards for
 * /sign-in, /sign-up, /meetings, etc. should use this so anon sessions
 * don't accidentally trigger "you're already signed in" flows. (PROD-487)
 */
export async function getCurrentSignedInUserId(): Promise<string | null> {
  const supabase = await getSupabaseUser();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (user.is_anonymous) return null;
  return user.id;
}
