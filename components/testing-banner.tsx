import { Sparkles } from "lucide-react";

export function TestingBanner() {
  return (
    <div
      role="status"
      aria-label="Site status notice"
      className="bg-[var(--layers-ink,oklch(0.22_0.035_256))] text-[oklch(0.92_0.02_256)] dark:bg-[oklch(0.14_0.02_256)] dark:text-[oklch(0.86_0.02_256)]"
      style={{
        // Fill the iOS dynamic island / Android display cutout area with the
        // banner background on native builds; resolves to 0 on web.
        paddingTop: "var(--safe-top)",
        paddingLeft: "var(--safe-left)",
        paddingRight: "var(--safe-right)",
      }}
    >
      <div className="mx-auto flex max-w-[1180px] items-center justify-center gap-2 px-6 py-2 text-[12px] font-medium tracking-[0.08em] uppercase md:px-10">
        <Sparkles size={13} aria-hidden="true" />
        We're in invite-only alpha — public sign-ups coming soon
      </div>
    </div>
  );
}
