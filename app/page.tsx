import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { LandingPage } from "./landing";
import { RecorderHome } from "./recorder";

export default async function HomePage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let isAuthenticated = false;

  if (url && anonKey) {
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anonKey, {
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
            // setAll called from Server Component — safe to ignore
            // since middleware handles session refresh
          }
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    isAuthenticated = !!user && user.is_anonymous !== true && !!user.email;
  }

  if (isAuthenticated) {
    return <RecorderHome />;
  }

  return <LandingPage />;
}
