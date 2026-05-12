import Link from "next/link";
import { LayersLogo } from "@/components/layers-logo";

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/download", label: "Download" },
  { href: "/changelog", label: "Changelog" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/account-deletion", label: "Account deletion" },
] as const;

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z"
      />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer
      aria-labelledby="site-footer-heading"
      className="border-t border-[var(--border-subtle,oklch(0.84_0.024_168/0.6))] bg-[var(--bg-page,oklch(0.982_0.012_168))]"
    >
      <h2 id="site-footer-heading" className="sr-only">
        Site footer
      </h2>

      <div className="mx-auto flex max-w-[1180px] flex-col items-start gap-6 px-6 py-10 sm:py-12 md:flex-row md:items-center md:justify-between md:gap-10 md:px-10">
        <Link
          href="/"
          aria-label="Layers home"
          className="inline-flex items-center"
        >
          <LayersLogo />
        </Link>

        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap items-center gap-x-7 gap-y-3 text-[14px]"
        >
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-[var(--text-secondary,oklch(0.46_0.025_256))] transition-colors hover:text-[var(--text-primary,oklch(0.22_0.035_256))]"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <a
            href="mailto:support@mirrorfactory.ai"
            aria-label="Email support"
            className="text-[14px] text-[var(--text-secondary,oklch(0.46_0.025_256))] transition-colors hover:text-[var(--text-primary,oklch(0.22_0.035_256))]"
          >
            Contact
          </a>
          <a
            href="https://x.com/mirrorfactory"
            target="_blank"
            rel="noreferrer"
            aria-label="Layers on X"
            className="text-[var(--text-secondary,oklch(0.46_0.025_256))] transition-colors hover:text-[var(--text-primary,oklch(0.22_0.035_256))]"
          >
            <XIcon className="h-[16px] w-[16px]" />
          </a>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 border-t border-[var(--border-subtle,oklch(0.84_0.024_168/0.4))] px-6 py-5 text-[12px] text-[var(--text-tertiary,oklch(0.56_0.025_256))] md:px-10">
        <p>© {new Date().getFullYear()} Mirror Factory. All rights reserved.</p>
        <p className="hidden md:block">
          Capture conversations passively. Decide faster.
        </p>
      </div>
    </footer>
  );
}
