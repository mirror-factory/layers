"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  ListChecks,
  Mic2,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import AudioWaveRibbon from "@/components/audio-wave-ribbon";
import { LayersLogo } from "@/components/layers-logo";
import { ProductLogo, type ProductLogoId } from "@/components/product-logos";
import { PublicSiteNav } from "@/components/public-site-nav";

const TRANSCRIPT_LINES = [
  ["00:04", "Let's lock the onboarding decision before the next customer call."],
  ["00:18", "Jamie owns the first-run copy. Alex owns the pricing deck."],
  ["00:35", "Ship the activation flow first, then follow with team sharing."],
  ["00:52", "Pull the customer objections into the launch brief."],
];

const MEMORY_OUTPUTS = [
  {
    title: "Decisions",
    count: "2",
    items: ["Ship onboarding first", "Position launch around private meeting memory"],
  },
  {
    title: "Actions",
    count: "4",
    items: ["Jamie: first-run copy", "Alex: pricing deck", "Taylor: analytics events"],
  },
  {
    title: "Intake",
    count: "3",
    items: ["Customer objections", "Timeline pressure", "Stakeholder names"],
  },
];

const AI_TOOLS: Array<{
  id: ProductLogoId;
  question: string;
  answer: string;
}> = [
  {
    id: "chatgpt",
    question: "What did we decide about onboarding?",
    answer:
      "Ship onboarding first, reduce the first-run steps, and measure activation rate plus time-to-value.",
  },
  {
    id: "claude",
    question: "Draft the follow-up from the product planning call.",
    answer:
      "The follow-up should recap the onboarding decision, owners, pricing deck deadline, and customer-objection brief.",
  },
  {
    id: "gemini",
    question: "What risks were raised for the launch plan?",
    answer:
      "The team flagged integration timing, unclear enterprise positioning, and missing analytics events.",
  },
];

const USE_CASES = [
  {
    icon: Users,
    title: "For teams that need memory, not another bot",
    body: "Founders, product teams, and GTM teams can record privately and still leave with decisions, owners, and follow-up context.",
  },
  {
    icon: FileText,
    title: "Built around the actual meeting artifact",
    body: "Transcript, summary, decisions, actions, intake, usage, and search live together instead of scattered across tools.",
  },
  {
    icon: Sparkles,
    title: "Ready for the AI tools you already use",
    body: "Layers turns meetings into reusable context for ChatGPT, Claude, Gemini, MCP clients, and your internal workflows.",
  },
];

const PRICING_TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "25 meetings included",
    href: "/sign-up",
    cta: "Start free",
    features: ["25 meetings lifetime", "Live and uploaded recordings", "Searchable meeting library"],
  },
  {
    name: "Core",
    price: "$20",
    cadence: "per user / month",
    href: "/pricing",
    cta: "See Core",
    featured: true,
    features: ["Unlimited meetings", "Enhanced speech-to-text", "Decisions, actions, and intake"],
  },
  {
    name: "Pro",
    price: "$30",
    cadence: "per user / month",
    href: "/pricing",
    cta: "See Pro",
    features: ["Team memory", "Advanced model routing", "Admin and priority support"],
  },
];

function useLandingAudioLevel() {
  const [level, setLevel] = useState(0.34);

  useEffect(() => {
    let t = 0;
    const timer = window.setInterval(() => {
      t += 0.08;
      const broad = Math.sin(t * 0.72) * 0.14;
      const detail = Math.sin(t * 1.9 + 0.4) * 0.08;
      const pulse = Math.abs(Math.sin(t * 0.38)) * 0.11;
      setLevel(0.34 + broad + detail + pulse);
    }, 70);

    return () => window.clearInterval(timer);
  }, []);

  return level;
}

function AppCapturePreview({ audioLevel }: { audioLevel: number }) {
  return (
    <div className="memory-app-preview" aria-label="Layers app preview">
      <div className="memory-app-window">
        <div className="memory-app-topbar">
          <LayersLogo />
          <span>Recording workspace</span>
          <small>Private capture</small>
        </div>

        <div className="memory-app-grid">
          <section className="memory-recorder-pane">
            <div className="memory-pane-heading">
              <span>
                <CalendarDays size={15} aria-hidden="true" />
                Product planning
              </span>
              <strong>10:13 AM</strong>
            </div>
            <div className="memory-recorder-clock">
              <span>00</span>
              <span>13</span>
              <small>live</small>
            </div>
            <div className="memory-recorder-wave" aria-hidden="true">
              <AudioWaveRibbon
                active
                audioLevel={audioLevel}
                height={118}
                motion={1.28}
                sensitivity={1.04}
                texture="clean"
              />
            </div>
            <div className="memory-capture-controls">
              <span>
                <Mic2 size={16} aria-hidden="true" />
                Recording locally
              </span>
              <button type="button">Stop</button>
            </div>
          </section>

          <section className="memory-transcript-pane">
            <div className="memory-pane-heading">
              <span>
                <FileText size={15} aria-hidden="true" />
                Live transcript
              </span>
              <small>Speaker aware</small>
            </div>
            <div className="memory-transcript-list">
              {TRANSCRIPT_LINES.map(([time, text]) => (
                <p key={time}>
                  <time>{time}</time>
                  <span>{text}</span>
                </p>
              ))}
            </div>
          </section>

          <section className="memory-output-summary">
            <div className="memory-pane-heading">
              <span>
                <ListChecks size={15} aria-hidden="true" />
                Meeting memory
              </span>
              <small>Updating</small>
            </div>
            <div className="memory-output-stack">
              {MEMORY_OUTPUTS.map((column) => (
                <article key={column.title}>
                  <h3>
                    {column.title}
                    <span>{column.count}</span>
                  </h3>
                  <ul>
                    {column.items.map((item) => (
                      <li key={item}>
                        <CheckCircle2 size={13} aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ToolCard({
  tool,
  active,
  onSelect,
}: {
  tool: (typeof AI_TOOLS)[number];
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`memory-ai-tool-card ${active ? "is-active" : ""}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <ProductLogo id={tool.id} />
      <span className="memory-ai-question">{tool.question}</span>
      <span className="memory-ai-answer">{tool.answer}</span>
      <span className="memory-ai-source">
        <ShieldCheck size={14} aria-hidden="true" />
        Sourced from Layers memory
      </span>
    </button>
  );
}

function SearchMemoryPanel() {
  return (
    <section className="memory-section memory-search-section">
      <div className="memory-section-copy">
        <span className="memory-section-kicker">Search</span>
        <h2>Find the decision without reopening every transcript.</h2>
        <p>
          Search meeting memory by customer, owner, action item, topic, or exact
          quote. Layers keeps the original source attached.
        </p>
      </div>
      <div className="memory-search-panel">
        <div className="memory-search-bar">
          <Search size={16} aria-hidden="true" />
          <span>onboarding objections</span>
          <kbd>Cmd K</kbd>
        </div>
        <div className="memory-search-results">
          {[
            ["Product planning", "Decision: ship onboarding first", "00:35"],
            ["Customer feedback", "Objection: setup asks too much too soon", "12:08"],
            ["GTM sync", "Owner: Alex to revise pricing deck", "04:44"],
          ].map(([title, body, time]) => (
            <article key={title}>
              <time>{time}</time>
              <div>
                <strong>{title}</strong>
                <p>{body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function StructuredOutputsPanel() {
  return (
    <section className="memory-section memory-outputs-section">
      <div className="memory-section-copy">
        <span className="memory-section-kicker">Outputs</span>
        <h2>The result looks like work your team can use.</h2>
        <p>
          Layers does not stop at a transcript. Every meeting produces summary,
          decisions, actions, intake, follow-up context, and clean exports.
        </p>
      </div>
      <div className="memory-output-panel">
        <div className="memory-output-tabs" aria-label="Output tabs">
          {["Summary", "Decisions", "Actions", "Intake", "Follow-up"].map((tab, index) => (
            <span className={index === 1 ? "is-active" : ""} key={tab}>
              {tab}
            </span>
          ))}
        </div>
        <div className="memory-output-columns">
          {MEMORY_OUTPUTS.map((column) => (
            <article className="memory-output-column" key={column.title}>
              <h3>
                {column.title}
                <span>{column.count}</span>
              </h3>
              <ul>
                {column.items.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={14} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  const audioLevel = useLandingAudioLevel();
  const [activeTool, setActiveTool] = useState(0);
  const selectedTool = useMemo(() => AI_TOOLS[activeTool], [activeTool]);

  return (
    <main className="memory-landing min-h-screen-safe">
      <PublicSiteNav />

      <section className="memory-hero memory-hero-app">
        <div className="memory-hero-copy">
          <span className="memory-hero-kicker">Private meeting memory for product and GTM teams</span>
          <h1>Record the conversation. Ship the follow-through.</h1>
          <p>
            Layers captures meetings without joining as a bot, then turns the
            conversation into searchable memory, decisions, action items, and
            context your AI tools can use.
          </p>
          <div className="memory-hero-actions">
            <Link href="/sign-up" className="memory-button memory-button-primary">
              Start free
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/download" className="memory-button memory-button-secondary">
              See download options
            </Link>
          </div>
          <div className="memory-ai-strip" aria-label="AI tool support">
            <span>Works with</span>
            <ProductLogo id="chatgpt" />
            <ProductLogo id="claude" />
            <ProductLogo id="gemini" />
            <span className="memory-mcp-chip">MCP clients</span>
          </div>
        </div>

        <div className="memory-hero-wave" aria-hidden="true">
          <AudioWaveRibbon
            active
            audioLevel={audioLevel * 0.82}
            height={150}
            motion={1.15}
            sensitivity={0.92}
            texture="clean"
          />
        </div>

        <AppCapturePreview audioLevel={audioLevel} />
      </section>

      <section className="memory-use-case-grid" aria-label="Why teams use Layers">
        {USE_CASES.map((item) => {
          const Icon = item.icon;

          return (
            <article key={item.title}>
              <Icon size={18} aria-hidden="true" />
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </article>
          );
        })}
      </section>

      <section className="memory-panel memory-tools-panel" aria-labelledby="ai-tools-heading">
        <div className="memory-panel-heading">
          <div>
            <span className="memory-section-kicker">AI context</span>
            <h2 id="ai-tools-heading">Ask your AI tools what happened.</h2>
            <p>
              ChatGPT, Claude, Gemini, and MCP clients can answer from the same
              meeting source instead of whatever was manually copied over.
            </p>
          </div>
          <span className="memory-selected-tool">
            <ProductLogo id={selectedTool.id} />
            selected
          </span>
        </div>
        <div className="memory-tool-grid">
          {AI_TOOLS.map((tool, index) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              active={index === activeTool}
              onSelect={() => setActiveTool(index)}
            />
          ))}
        </div>
      </section>

      <SearchMemoryPanel />
      <StructuredOutputsPanel />

      <section className="memory-section memory-pricing-section" id="pricing">
        <div className="memory-section-copy">
          <span className="memory-section-kicker">Pricing</span>
          <h2>Start free. Upgrade when meeting memory becomes daily infrastructure.</h2>
          <p>
            Plans stay simple so teams can evaluate the workflow before they
            commit to more usage and shared workspace controls.
          </p>
        </div>
        <div className="memory-pricing-grid">
          {PRICING_TIERS.map((tier) => (
            <article
              className={`memory-price-card ${tier.featured ? "is-featured" : ""}`}
              key={tier.name}
            >
              <div>
                <span className="memory-price-name">
                  {tier.name}
                  {tier.featured ? <small>Most teams start here</small> : null}
                </span>
                <strong>{tier.price}</strong>
                <p>{tier.cadence}</p>
              </div>
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
      </section>

      <footer className="memory-footer">
        <LayersLogo />
        <nav aria-label="Footer">
          <Link href="/download">Download</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/account-deletion">Delete account</Link>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up">Start free</Link>
        </nav>
      </footer>
    </main>
  );
}

export default LandingPage;
