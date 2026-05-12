import type { ReactNode } from "react";
import { PublicSiteNav } from "@/components/public-site-nav";
import { SiteFooter } from "@/components/site-footer";
import { TestingBanner } from "@/components/testing-banner";
import { getCurrentSignedInUserId } from "@/lib/supabase/user";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  // PROD-487: anon Supabase sessions don't count as "signed in" — the
  // hamburger should still show Sign in for them.
  const isAuthed = (await getCurrentSignedInUserId()) != null;
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page,oklch(0.982_0.012_168))] text-[var(--text-primary,oklch(0.22_0.035_256))]">
      <TestingBanner />
      <PublicSiteNav isAuthed={isAuthed} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
