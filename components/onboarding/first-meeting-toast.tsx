"use client";

/**
 * FirstMeetingToast — the "first-meeting helper" surface (PROD-389).
 *
 * Renders at the top of `/meetings/[id]` the first time a freshly-onboarded
 * user lands here after a recording. The dismiss-once contract is enforced
 * by the onboarding state machine — this component renders nothing if
 * `firstMeetingSeen === true`.
 *
 * Behaviour:
 *   - Auto-hides after 12 seconds (long enough to read, short enough to
 *     not clutter a returning user's first scroll).
 *   - Manual dismiss via the close button.
 *   - "Open summary" CTA scrolls to the summary block. If the host page
 *     does not expose `data-onboarding-anchor="summary"`, falls back to
 *     scrolling to the top of the page so the panel above the fold is
 *     still surfaced — never crashes.
 *   - Polite live region so screen readers announce it without
 *     interrupting playback or other speech.
 *   - Respects prefers-reduced-motion.
 */

import { useEffect, useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { useOnboarding } from "./onboarding-provider";
import { onboardingCopy, ONBOARDING_ANCHOR_ATTR } from "@/lib/onboarding/copy";

const AUTO_HIDE_MS = 12_000;

export function FirstMeetingToast() {
  const { ready, state, markFirstMeetingSeen } = useOnboarding();
  // Dismissed-locally is the only piece of UI state — visibility otherwise
  // derives directly from the onboarding state machine. This avoids the
  // "setState in effect" footgun the React Compiler flags.
  const [locallyDismissed, setLocallyDismissed] = useState(false);

  const open = ready && !state.firstMeetingSeen && !locallyDismissed;

  function handleDismiss() {
    setLocallyDismissed(true);
    markFirstMeetingSeen();
  }

  function handleOpenSummary() {
    if (typeof document !== "undefined") {
      const target = document.querySelector(
        `[${ONBOARDING_ANCHOR_ATTR}="summary"]`,
      );
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
    handleDismiss();
  }

  // Auto-hide timer.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setLocallyDismissed(true);
      markFirstMeetingSeen();
    }, AUTO_HIDE_MS);
    return () => window.clearTimeout(id);
  }, [open, markFirstMeetingSeen]);

  if (!open) return null;

  return (
    <div className="onboarding-first-meeting" role="status" aria-live="polite">
      <span className="onboarding-first-meeting-icon" aria-hidden="true">
        <CheckCircle2 size={18} />
      </span>
      <div className="onboarding-first-meeting-copy">
        <p className="onboarding-first-meeting-title">
          {onboardingCopy.firstMeeting.title}
        </p>
        <p className="onboarding-first-meeting-body">
          {onboardingCopy.firstMeeting.body}
        </p>
      </div>
      <button
        type="button"
        className="onboarding-first-meeting-cta"
        onClick={handleOpenSummary}
      >
        {onboardingCopy.firstMeeting.cta}
      </button>
      <button
        type="button"
        className="onboarding-first-meeting-close"
        onClick={handleDismiss}
        aria-label={onboardingCopy.firstMeeting.dismissAria}
      >
        <X size={16} aria-hidden="true" />
      </button>

      <style jsx>{`
        .onboarding-first-meeting {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          background: color-mix(
            in oklch,
            var(--layers-mint-tint) 70%,
            var(--bg-surface)
          );
          border: 1px solid
            color-mix(in oklch, var(--layers-mint) 30%, transparent);
          animation: onboardingToastIn 220ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .onboarding-first-meeting-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 9999px;
          color: var(--layers-mint);
          background: color-mix(
            in oklch,
            var(--layers-mint) 22%,
            transparent
          );
          flex-shrink: 0;
        }
        .onboarding-first-meeting-copy {
          flex: 1;
          min-width: 0;
        }
        .onboarding-first-meeting-title {
          margin: 0;
          font-family: var(--font-brand-sans);
          font-size: 0.92rem;
          font-weight: 580;
          color: var(--layers-ink);
        }
        .onboarding-first-meeting-body {
          margin: 2px 0 0;
          font-size: 0.82rem;
          line-height: 1.5;
          color: var(--fg-muted);
        }
        .onboarding-first-meeting-cta {
          appearance: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          padding: 7px 14px;
          border-radius: 999px;
          border: 1px solid
            color-mix(in oklch, var(--layers-ink) 88%, transparent);
          background: var(--layers-ink);
          color: var(--bg-surface, #fff);
          font-family: var(--font-brand-sans);
          font-size: 0.84rem;
          font-weight: 560;
          cursor: pointer;
          flex-shrink: 0;
          transition:
            background var(--duration-fast, 140ms) var(--ease-out, ease),
            transform var(--duration-fast, 140ms) var(--ease-out, ease);
        }
        .onboarding-first-meeting-cta:hover {
          background: color-mix(
            in oklch,
            var(--layers-ink) 92%,
            var(--layers-mint)
          );
        }
        .onboarding-first-meeting-cta:active {
          transform: translateY(1px);
        }
        .onboarding-first-meeting-cta:focus-visible {
          outline: 2px solid var(--layers-mint);
          outline-offset: 3px;
        }
        .onboarding-first-meeting-close {
          appearance: none;
          background: transparent;
          border: 0;
          padding: 6px;
          color: var(--fg-muted);
          cursor: pointer;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: color var(--duration-fast, 140ms) var(--ease-out, ease);
        }
        .onboarding-first-meeting-close:hover {
          color: var(--layers-ink);
        }
        .onboarding-first-meeting-close:focus-visible {
          outline: 2px solid var(--layers-mint);
          outline-offset: 2px;
        }
        @keyframes onboardingToastIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .onboarding-first-meeting {
            animation: none;
          }
          .onboarding-first-meeting-cta:active {
            transform: none;
          }
        }
        @media (max-width: 640px) {
          .onboarding-first-meeting {
            flex-wrap: wrap;
          }
          .onboarding-first-meeting-cta {
            order: 3;
            flex: 1 0 auto;
          }
        }
      `}</style>
    </div>
  );
}
