"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let instance: SupabaseClient | null = null;

/**
 * Browser-side Supabase client (singleton).
 * Uses @supabase/ssr's createBrowserClient which properly syncs
 * cookies with the server middleware.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (instance) return instance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  instance = createBrowserClient(url, anonKey);
  return instance;
}
