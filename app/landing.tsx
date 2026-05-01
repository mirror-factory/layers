"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  Mail,
  Mic2,
  NotepadText,
  Search,
  Sparkles,
} from "lucide-react";
import AudioWaveRibbon from "@/components/audio-wave-ribbon";
import { LayersLogo, LayersLogoMark } from "@/components/layers-logo";
import { ProductLogo } from "@/components/product-logos";

const TRUSTED_TEAMS = ["Linear", "Vercel", "dribbble", "Notion", "Lattice", "Retool"];

const PRICING_TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "25 meetings included",
    href: "/sign-up",
    cta: "Start free",
    features: ["25 meetings lifetime", "AI summaries", "Searchable memory"],
  },
  {
    name: "Core",
    price: "$20",
    cadence: "per user / month",
    href: "/pricing",
    cta: "See Core",
    featured: true,
    features: ["Unlimited meetings", "AI memory and search", "Share and export"],
  },
  {
    name: "Pro",
    price: "$30",
    cadence: "per user / month",
    href: "/pricing",
    cta: "See Pro",
    features: ["Team memory", "Advanced privacy", "Priority support"],
  },
];

function LandingNav() {
  return (
    <header className="reference-nav">
      <Link href="/" className="reference-brand" aria-label="Layers home">
        <LayersLogo />
      </Link>

      <nav className="reference-nav-links" aria-label="Homepage navigation">
        <a href="#product">Product</a>
        <a href="#solutions">
          Solutions
          <ChevronDown size={13} aria-hidden="true" />
        </a>
        <Link href="/pricing">Pricing</Link>
        <a href="#resources">
          Resources
          <ChevronDown size={13} aria-hidden="true" />
        </a>
      </nav>

      <div className="reference-nav-actions">
        <Link href="/sign-in">Sign in</Link>
        <Link href="/sign-up" className="reference-nav-cta">
          Start free
        </Link>
      </div>
    </header>
  );
}

function HeroMockup() {
  return (
    <div className="reference-hero-visual" aria-label="Layers recording workspace preview">
      <div className="reference-orbit" aria-hidden="true" />
      <div className="reference-floating-note reference-note-memory">
        <span />
        <div>
          <strong>AI memory</strong>
          <small>Always learning</small>
        </div>
      </div>
      <div className="reference-floating-stat reference-stat-decisions">
        <span>Decisions</span>
        <strong>2</strong>
        <small>Captured</small>
      </div>
      <div className="reference-floating-stat reference-stat-actions">
        <span>Actions</span>
        <strong>4</strong>
        <small>Assigned</small>
      </div>
      <div className="reference-floating-stat reference-stat-followups">
        <span>Follow-ups</span>
        <strong>2</strong>
        <small>Planned</small>
      </div>

      <div className="reference-app-window">
        <div className="reference-app-topbar">
          <LayersLogo />
          <span>Recording workspace</span>
          <small>Private capture</small>
        </div>

        <div className="reference-app-grid">
          <section className="reference-recording-card" aria-label="Recording state">
            <div className="reference-card-line">
              <span>Product planning</span>
              <strong>10:13 AM</strong>
            </div>
            <div className="reference-clock">
              00:13
              <span>Live</span>
            </div>
            <div className="reference-wave">
              <AudioWaveRibbon
                active
                audioLevel={0.68}
                height={104}
                motion={1.12}
                sensitivity={0.88}
                texture="clean"
              />
            </div>
            <div className="reference-recording-footer">
              <span>
                <Mic2 size={14} aria-hidden="true" />
                Recording locally
              </span>
              <button type="button">Stop</button>
            </div>
          </section>

          <section className="reference-transcript-card" aria-label="Live transcript">
            <div className="reference-card-line">
              <span>Live transcript</span>
              <small>Speaker aware</small>
            </div>
            {[
              ["00:04", "Let's lock the onboarding decision before the next customer call."],
              ["00:18", "Jamie owns the first-run copy. Alex owns the pricing deck."],
              ["00:35", "Ship the activation flow first, then follow with team sharing."],
              ["00:52", "Pull the customer objections into the launch doc."],
            ].map(([time, text]) => (
              <p key={time}>
                <time>{time}</time>
                <span>{text}</span>
              </p>
            ))}
          </section>

          <section className="reference-memory-card" aria-label="Meeting memory">
            <div className="reference-card-line">
              <span>Meeting memory</span>
              <small>Updating</small>
            </div>
            {[
              ["Decisions", "2"],
              ["Actions", "4"],
              ["Intake", "3"],
              ["Follow-up", "2"],
            ].map(([label, count]) => (
              <p key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
              </p>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

function MemoryVisual() {
  return (
    <div className="reference-visual-panel reference-memory-visual" aria-label="Meeting memory card">
      <div className="reference-soft-wave" aria-hidden="true" />
      <article>
        <div className="reference-panel-header">
          <span>
            <NotepadText size={15} aria-hidden="true" />
            Meeting memory
          </span>
          <small>Updating</small>
        </div>
        <h3>What happened</h3>
        <p>Reviewed onboarding flow and activation metrics.</p>
        <div className="reference-decision-row">
          Decision: Ship activation flow before team sharing.
        </div>
        <div className="reference-action-row">
          Action: Jamie to draft first-run copy by Friday.
        </div>
        <footer>
          <CheckCircle2 size={14} aria-hidden="true" />
          Generated by Layers
        </footer>
      </article>
      <span className="reference-sparkle-badge">
        <Sparkles size={22} aria-hidden="true" />
      </span>
    </div>
  );
}

function SearchVisual() {
  return (
    <div className="reference-visual-panel reference-search-visual" aria-label="Search memory preview">
      <div className="reference-search-bar">
        <Search size={17} aria-hidden="true" />
        <span>onboarding objections</span>
        <kbd>Cmd K</kbd>
      </div>
      {[
        ["00:35", "Product planning", "Decision: ship onboarding first"],
        ["12:08", "Customer feedback", "Objection: setup takes too much time"],
        ["27:42", "GTM sync", "Action: add ROI stats to deck"],
      ].map(([time, title, body]) => (
        <article key={time}>
          <time>{time}</time>
          <div>
            <strong>{title}</strong>
            <p>{body}</p>
          </div>
        </article>
      ))}
      <div className="reference-found-card">
        <CheckCircle2 size={15} aria-hidden="true" />
        <span>
          Found in
          <strong>18 meetings</strong>
        </span>
      </div>
    </div>
  );
}

function AssetsVisual() {
  return (
    <div className="reference-visual-panel reference-assets-visual" aria-label="Reusable assets preview">
      <div className="reference-output-tabs">
        <span className="is-active">Outputs</span>
        <span>Templates</span>
        <span>Integrations</span>
      </div>
      <div className="reference-output-grid">
        {[
          ["Summary doc", "Product planning - May 16", "W"],
          ["Decision log", "Q2 Roadmap", "S"],
          ["Action tracker", "12 tasks", "OK"],
          ["Customer update", "Weekly digest", "Mail"],
        ].map(([title, detail, icon]) => (
          <article key={title}>
            <strong>{title}</strong>
            <span>{detail}</span>
            <i>{icon}</i>
          </article>
        ))}
      </div>
      <div className="reference-share-card">
        <span>Share to</span>
        <strong>N</strong>
        <strong>Slack</strong>
        <strong>Drive</strong>
        <strong>...</strong>
      </div>
    </div>
  );
}

function PricingPreview() {
  return (
    <div className="reference-pricing-cards" aria-label="Pricing preview">
      {PRICING_TIERS.map((tier) => (
        <article className={tier.featured ? "is-featured" : ""} key={tier.name}>
          <div className="reference-price-name">
            <span>{tier.name}</span>
            {tier.featured ? <small>Most popular</small> : null}
          </div>
          <strong>{tier.price}</strong>
          <p>{tier.cadence}</p>
          <ul>
            {tier.features.map((feature) => (
              <li key={feature}>
                <CheckCircle2 size={14} aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
          <Link href={tier.href}>{tier.cta}</Link>
        </article>
      ))}
    </div>
  );
}

function FeatureCopy({
  index,
  eyebrow,
  title,
  body,
  bullets,
}: {
  index: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
}) {
  return (
    <div className="reference-feature-copy">
      <span className="reference-kicker">
        {index}
        <strong>{eyebrow}</strong>
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
      <ul>
        {bullets.map((bullet) => (
          <li key={bullet}>
            <CheckCircle2 size={15} aria-hidden="true" />
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingPage() {
  return (
    <main className="reference-landing min-h-screen-safe">
      <LandingNav />

      <section className="reference-hero" id="product">
        <div className="reference-hero-copy">
          <h1>AI memory for your meetings.</h1>
          <p className="reference-script">Decisions that move work forward.</p>
          <p>
            Layers remembers what matters from every conversation so your team
            can make better decisions and ship faster.
          </p>
          <div className="reference-hero-actions">
            <Link href="/sign-up" className="reference-primary-button">
              Start free
            </Link>
            <Link href="#how-it-works" className="reference-secondary-button">
              See how it works
            </Link>
          </div>
          <div className="reference-tool-strip" aria-label="Supported AI tools">
            <span>Works with</span>
            <div>
              <ProductLogo id="chatgpt" />
              <ProductLogo id="claude" />
              <ProductLogo id="gemini" />
              <span className="reference-mcp-chip">
                <Sparkles size={14} aria-hidden="true" />
                MCP clients
              </span>
            </div>
          </div>
        </div>

        <HeroMockup />
      </section>

      <section className="reference-trust" aria-label="Trusted by product and GTM teams">
        <div>
          <span />
          <p>Trusted by product and GTM teams</p>
          <span />
        </div>
        <ul>
          {TRUSTED_TEAMS.map((team) => (
            <li key={team}>{team}</li>
          ))}
        </ul>
      </section>

      <section className="reference-feature-row" id="how-it-works">
        <FeatureCopy
          index="01"
          eyebrow="AI memory that works for you"
          title="Your AI copilots learn from every meeting."
          body="Layers captures the full picture - context, decisions, actions, and follow-ups - and keeps it organized in one intelligent memory."
          bullets={[
            "Speaker-aware transcripts",
            "Automatic summaries and decisions",
            "Action items with owners and due dates",
          ]}
        />
        <MemoryVisual />
      </section>

      <section className="reference-feature-row is-flipped">
        <SearchVisual />
        <FeatureCopy
          index="02"
          eyebrow="Search that finds answers"
          title="Find the decision without reopening every transcript."
          body="Search across meeting memory, not files. Layers surfaces precise moments, so you get answers in seconds."
          bullets={[
            "Natural language search",
            "Jump to the exact moment",
            "Filter by meeting, topic, people, and more",
          ]}
        />
      </section>

      <section className="reference-feature-row" id="solutions">
        <FeatureCopy
          index="03"
          eyebrow="Reuse what matters"
          title="Turn conversations into reusable assets."
          body="Layers turns meeting memory into the outputs your team actually uses automatically."
          bullets={[
            "Summaries, docs, and updates",
            "Action trackers and decision logs",
            "Share to tools your team already uses",
          ]}
        />
        <AssetsVisual />
      </section>

      <section className="reference-feature-row reference-pricing-section" id="resources">
        <FeatureCopy
          index="04"
          eyebrow="Built for teams at every stage"
          title="Simple pricing. Serious value."
          body="Start free. Upgrade when your team is ready to do more with meeting memory."
          bullets={[]}
        />
        <PricingPreview />
      </section>

      <section className="reference-cta">
        <div className="reference-cta-mark">
          <LayersLogoMark size={48} animated />
        </div>
        <div>
          <h2>Ready to make every meeting count?</h2>
          <p>Join teams that ship faster with better context.</p>
        </div>
        <nav aria-label="Get started">
          <Link href="/sign-up" className="reference-primary-button">
            Start free
          </Link>
          <Link href="/download" className="reference-secondary-button">
            Book a demo
          </Link>
        </nav>
      </section>

      <footer className="reference-footer">
        <LayersLogo />
        <nav aria-label="Footer">
          <a href="#product">Product</a>
          <a href="#solutions">Solutions</a>
          <Link href="/pricing">Pricing</Link>
          <a href="#resources">Resources</a>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href="mailto:admin@mirrorfactory.ai">
            <Mail size={14} aria-hidden="true" />
            Contact
          </a>
        </nav>
      </footer>
    </main>
  );
}

export default LandingPage;
