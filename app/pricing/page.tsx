"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { ProductLogo } from "@/components/product-logos";
import { PublicSiteNav } from "@/components/public-site-nav";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    summary: "Try the full meeting-memory workflow with a real launch account.",
    included: "25 meetings lifetime",
    cta: "Start free",
    href: "/sign-up",
    tier: null,
    highlight: false,
    features: [
      "Live and uploaded recordings",
      "Transcript, summary, actions, and decisions",
      "Search across your meeting library",
      "Transparent usage view",
    ],
  },
  {
    name: "Core",
    price: "$20",
    period: "per user / month",
    summary: "For founders and operators who use Layers every week.",
    included: "Unlimited meetings",
    cta: "Subscribe to Core",
    tier: "core" as const,
    highlight: true,
    features: [
      "600 transcription minutes included",
      "Enhanced speech-to-text",
      "AI summaries, decisions, actions, and intake",
      "Calendar context",
      "AI tool-ready meeting memory",
    ],
  },
  {
    name: "Pro",
    price: "$30",
    period: "per user / month",
    summary: "For teams that want richer context and stronger controls.",
    included: "1,500 transcription minutes included",
    cta: "Subscribe to Pro",
    tier: "pro" as const,
    highlight: false,
    features: [
      "Everything in Core",
      "Advanced model routing",
      "Team library and sharing",
      "Admin controls",
      "Priority support",
    ],
  },
];

const COMPARISON = [
  ["Meeting memory", "25 meetings", "Unlimited", "Unlimited"],
  ["Transcription minutes", "Included trial pool", "600 included", "1,500 included"],
  ["AI outputs", "Summary, actions, decisions", "Enhanced outputs", "Enhanced outputs"],
  ["Team controls", "Personal workspace", "Personal workspace", "Team-ready controls"],
];

export default function PricingPage() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async (tier: "core" | "pro") => {
    setLoadingTier(tier);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Checkout failed");
      }

      const { url } = await res.json();
      if (url) {
        globalThis.location.assign(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoadingTier(null);
    }
  };

  return (
    <main className="pricing-public-page min-h-screen-safe">
      <PublicSiteNav active="pricing" />

      <section className="pricing-hero">
        <span className="pricing-kicker">Pricing</span>
        <h1>Simple plans for private meeting memory.</h1>
        <p>
          Start with 25 free meetings. Upgrade when Layers becomes the place
          your team goes for decisions, actions, and AI-ready meeting context.
        </p>
        <div className="pricing-hero-tools" aria-label="AI tool support">
          <ProductLogo id="chatgpt" />
          <ProductLogo id="claude" />
          <ProductLogo id="gemini" />
        </div>
      </section>

      <section className="pricing-tier-grid" aria-label="Pricing plans">
        {TIERS.map((tier) => (
          <article className={`pricing-tier-card ${tier.highlight ? "is-featured" : ""}`} key={tier.name}>
            <div>
              <span className="pricing-tier-name">
                {tier.name}
                {tier.highlight ? <small>Most teams start here</small> : null}
              </span>
              <div className="pricing-tier-price">
                <strong>{tier.price}</strong>
                <span>{tier.period}</span>
              </div>
              <p>{tier.summary}</p>
            </div>

            <div className="pricing-tier-included">
              <ShieldCheck size={16} aria-hidden="true" />
              {tier.included}
            </div>

            <ul>
              {tier.features.map((feature) => (
                <li key={feature}>
                  <Check size={15} aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {tier.tier ? (
              <button
                type="button"
                onClick={() => handleCheckout(tier.tier)}
                disabled={loadingTier !== null}
                className="pricing-tier-action"
              >
                {loadingTier === tier.tier ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <>
                    {tier.cta}
                    <ArrowRight size={15} aria-hidden="true" />
                  </>
                )}
              </button>
            ) : (
              <Link href={tier.href} className="pricing-tier-action">
                {tier.cta}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            )}
          </article>
        ))}
      </section>

      {error ? <p className="pricing-error">{error}</p> : null}

      <section className="pricing-usage-panel">
        <div>
          <span className="pricing-kicker">Usage stays visible</span>
          <h2>Pricing is tied to actual meeting and model usage.</h2>
          <p>
            Layers keeps the cost surface visible so teams can understand
            transcription minutes, model usage, and plan fit before a surprise
            invoice appears.
          </p>
        </div>
        <div className="pricing-meter" aria-hidden="true">
          <span style={{ width: "38%" }} />
          <span style={{ width: "64%" }} />
          <span style={{ width: "82%" }} />
        </div>
      </section>

      <section className="pricing-comparison" aria-label="Plan comparison">
        <div className="pricing-comparison-row is-head">
          <span>Feature</span>
          <span>Free</span>
          <span>Core</span>
          <span>Pro</span>
        </div>
        {COMPARISON.map(([feature, free, core, pro]) => (
          <div className="pricing-comparison-row" key={feature}>
            <span>{feature}</span>
            <span>{free}</span>
            <span>{core}</span>
            <span>{pro}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
