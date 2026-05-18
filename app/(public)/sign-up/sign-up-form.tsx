"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import {
  AuthShell,
  AuthField,
  AuthError,
  AuthDivider,
  AuthPrimaryButton,
  AuthFootnote,
  AuthSwitchLink,
} from "@/components/auth-card";

export function SignUpPageClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Public sign-ups paused while we run an invite-only alpha.
  // Restore the Supabase signUp / Google OAuth handlers from git when re-opening.
  const ALPHA_INVITE_MESSAGE =
    "Public sign-ups are paused — we're in invite-only alpha. Email admin@mirafactory.ai for access.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(ALPHA_INVITE_MESSAGE);
  };

  if (success) {
    return (
      <AuthShell
        eyebrow="One more step"
        title="Check your email"
        lede="We sent a confirmation link to your inbox. Open it to finish setting up your Layers account."
        promise={
          <>
            <span className="auth-brand-promise-mission">
              AI memory for your meetings.
            </span>
            <span className="auth-brand-promise-secondary">
              A calmer place to keep what was said, decided, and asked of you.
            </span>
          </>
        }
        footer={
          <AuthSwitchLink
            prompt="Already confirmed?"
            href="/sign-in"
            cta="Sign in"
          />
        }
      >
        <div className="auth-success" role="status">
          <CheckCircle2
            size={20}
            aria-hidden="true"
            className="auth-success-icon"
          />
          <div>
            <p className="auth-success-line">
              Confirmation sent to{" "}
              <strong className="auth-success-email">{email}</strong>
            </p>
            <p className="auth-success-hint">
              The link is good for 24 hours. Didn&apos;t arrive? Check your spam
              folder, or try signing up again.
            </p>
          </div>
        </div>

        <AuthFootnote>
          Wrong email?{" "}
          <button
            type="button"
            onClick={() => setSuccess(false)}
            className="auth-success-reset"
          >
            Use a different one
          </button>
          .
        </AuthFootnote>

        <style jsx>{`
          .auth-success {
            display: flex;
            align-items: flex-start;
            gap: 14px;
            padding: 18px;
            border-radius: 16px;
            background: color-mix(
              in oklch,
              var(--layers-mint-tint) 80%,
              var(--bg-surface)
            );
            border: 1px solid
              color-mix(in oklch, var(--layers-mint) 24%, transparent);
          }
          .auth-success :global(.auth-success-icon) {
            color: var(--signal-success);
            flex-shrink: 0;
            margin-top: 2px;
          }
          .auth-success-line {
            margin: 0 0 6px;
            font-size: 0.95rem;
            color: var(--layers-ink);
            line-height: 1.5;
          }
          .auth-success-email {
            font-weight: 540;
          }
          .auth-success-hint {
            margin: 0;
            font-size: 0.85rem;
            line-height: 1.55;
            color: var(--fg-muted);
          }
          .auth-success-reset {
            background: none;
            border: 0;
            padding: 0;
            color: var(--layers-ink);
            text-decoration: underline;
            text-underline-offset: 3px;
            text-decoration-color: color-mix(
              in oklch,
              var(--layers-mint) 60%,
              transparent
            );
            cursor: pointer;
            font: inherit;
          }
        `}</style>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Create account"
      title="Start with Layers"
      lede="25 free meetings to see what Layers remembers for you — decisions, action items, and the context behind them. No card up front."
      promise={
        <>
          <span className="auth-brand-promise-mission">
            AI memory for your meetings.
          </span>
          <span className="auth-brand-promise-secondary">
            A calmer place to keep what was said, decided, and asked of you.
          </span>
        </>
      }
      trustBeats={[
        "Searchable memory of every decision",
        "Action items with owners and due dates",
        "Cancel any time",
      ]}
      footer={
        <AuthSwitchLink
          prompt="Already have an account?"
          href="/sign-in"
          cta="Sign in"
        />
      }
    >
      <a
        href="mailto:admin@mirafactory.ai?subject=Layers%20alpha%20access"
        className="auth-alpha-link"
      >
        Request alpha access
      </a>

      <AuthDivider label="or with email" />

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 6 characters"
          autoComplete="new-password"
          required
          minLength={6}
          hint="Use 6+ characters. Mix it up — we never see it in plain text."
        />
        <AuthPrimaryButton type="button" disabled>
          Coming soon
        </AuthPrimaryButton>
      </form>

      {error ? <AuthError message={error} /> : null}

      <AuthFootnote>
        By creating an account or continuing with Google, you agree to the{" "}
        <Link href="/terms">Terms</Link> and acknowledge the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </AuthFootnote>

      <style jsx>{`
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .auth-alpha-link {
          display: inline-flex;
          min-height: 48px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid
            color-mix(in oklch, var(--layers-mint) 42%, var(--border-default));
          background: var(--layers-mint-soft);
          color: var(--layers-ink);
          font-size: 0.95rem;
          font-weight: 650;
          letter-spacing: -0.005em;
          text-decoration: none;
          transition:
            background 150ms ease,
            transform 150ms ease;
        }
        .auth-alpha-link:hover {
          background: color-mix(
            in oklch,
            var(--layers-mint-soft) 86%,
            var(--layers-mint) 14%
          );
          transform: translateY(-1px);
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-alpha-link:hover {
            transform: none;
          }
        }
      `}</style>
    </AuthShell>
  );
}
