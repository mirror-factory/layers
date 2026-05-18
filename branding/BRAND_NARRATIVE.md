---
version: 1
name: "Layers Brand Narrative"
status: active
updated: "2026-05-12"
owners:
  - "Alfonso (founder)"
audience:
  - "design + product"
  - "marketing + content"
  - "Claude / Codex / future agents"
related:
  - "DESIGN.md"
  - "branding/design-kit.html"
  - "branding/htmlcanvas-playground.html"
  - ".claude/skills/layers-brand-remotion/SKILL.md"
  - "remotion/scenes/brand-template/"
linear:
  - "PROD-496"
---

# Layers — Brand Narrative

> The story that every video, asset, landing page, and tweet should be telling.
> Agents: read this before generating brand-facing copy or visuals.

---

## 1. The one-line

**Layers is the central context library for knowledge workers — portable to any LLM.**

Today's wedge is audio intake. The end state is your context, layered, wherever you work.

---

## 2. Who Layers is for

A knowledge worker who lives across tools.

- They take meetings in person, on Zoom, in Slack huddles, at a Starbucks counter.
- They jump between Claude, ChatGPT, Gemini, Cursor, Notion, a browser, a doc, a CRM.
- They are constantly **re-explaining themselves** to every tool, because each one starts cold.
- They are the kind of person who would say: _"I just want the AI to know what I'm working on without me retyping it for the tenth time today."_

We are not building for casual ChatGPT users. We are building for people whose **output depends on context**, and who already feel the pain of context loss.

---

## 3. The painful problem

> Your context lives in twelve places. None of them talk to each other. When you sit down at Claude or ChatGPT, you start from zero.

Concrete shapes of the pain:

- An impromptu meeting at a coffee shop — the decision lives only in your head until you forget it.
- A Slack DM with a customer insight — disappears into the scroll.
- A doc you wrote three weeks ago — you remember the conclusion but not the reasoning.
- A research session in your browser — closed tabs, lost.
- A pricing decision in a Zoom call — buried in a transcript no one re-reads.

LLMs are the **only** tools that could synthesize this, and they're the **one place** the context isn't.

---

## 4. The wedge — audio intake

Audio is where we start because it is the lowest-friction context capture available.

- Tap your phone. Speak. Done.
- Layers transcribes, structures, and stores into your library.
- The phone tap works the same way at a Starbucks counter, in a Zoom call, in a Slack huddle.
- Recording is the only moment a human has to be involved. After that, layers do the work.

This is the wedge. It is not the whole story. The wedge is what gets us in the door.

---

## 5. The end state — the library, layered

Every audio recording is one layer. Layers accumulate:

| Layer source | Example |
|---|---|
| Meetings | the Zoom you just left |
| Email threads | the customer back-and-forth from last week |
| Documents | the spec you wrote in March |
| Browser context | the research session on competitors |
| Calendar | recurring patterns, who you meet with |
| Files | the PDF a partner sent |
| Decisions | what your team agreed on, with sources |

These are not files in a folder. They are a queryable, structured context library — your context, indexed, attributable, and **portable**.

> Layers does not own where you do the work. Layers gives any LLM your context, when you need it, at the speed of a tap.

Portability: Claude (via MCP), ChatGPT (via Apps / connectors / MCP), Gemini (via extensions / MCP), Cursor (via MCP), and whatever ships next. We integrate with the tools where work happens — we do not try to replace them.

---

## 6. Visual metaphor — "You, with layers"

The brand has one strong visual idea that everything else hangs off of.

### The mark

- **A mint dot in the center.** That is _you_ — the source of all this context, the only constant across every tool you use.
- **An organic violet ring around it.** The first layer — your most recent context.
- **An organic blue ring around that.** The accumulated library — every layer you have already added.
- **Subtle motion in every ring.** Lines breathe. The system is alive, not static.

The mark already reflects this in the app (`components/layers-logo.tsx`); the new organic-line variant in `branding/design-kit.html` is the next step — same structure, but the rings are flowing lines instead of geometric arcs, matching the audio-wave ribbon's voice.

### Three colors carry the whole brand

These are the three colors visible on the moving organic wave in the app (`components/audio-wave-ribbon.tsx`):

| Token | OKLCH | rgba (canvas-side) | Role |
|---|---|---|---|
| `--layers-mint` | `oklch(0.68 0.13 166)` | `rgba(52, 211, 153, …)` | **Primary.** You. The center. The accent that signals "Layers is here." |
| `--layers-violet` | `oklch(0.66 0.16 282)` | `rgba(99, 102, 241, …)` (indigo end) → `rgba(196, 181, 253, …)` (soft) | **Active context.** The middle ring. The thing you are doing now. |
| `--layers-blue` | `oklch(0.66 0.13 240)` | (soft) `rgba(125, 174, 224, …)` | **The library.** The outer ring. Everything you have already layered in. |

These three colors are non-negotiable on brand surfaces. Soft variants are for backgrounds and washes; tints are for paper-on-paper subtlety. Never use raw hex outside of canvas/shader code where OKLCH isn't supported — even then, name the value as a Layers design value (see `DESIGN.md` agent rules).

### Organic motion

> Life is not grid-perfect. Lines breathe.

The audio-wave ribbon is the visual signature. Every brand motion piece should feel like a relative of it:

- Sinusoidal undertow + finer weave + finer-still detail.
- Three layered echoes — mint primary, violet halo, blue accent.
- A breath term (0.93 + 0.07 \* sin) so amplitude pulses even at idle.
- A soft halo via `feGaussianBlur` or `filter: blur()`, never a hard glow.

Frame-deterministic equivalents live in `remotion/components/AudioWave.tsx`. Use those in Remotion.

### Paper Calm surfaces

Backgrounds are warm paper (`bg-page`), not pure white. Cards are surface-on-surface with a 0.74-opacity warm border. This is from `DESIGN.md` and `app/globals.css` and we **do not change it without changing the design tokens first**.

---

## 7. Brand voice

We are extending Paper Calm v1.0 (in `DESIGN.md`) with a narrative tone for video and copy.

### Voice principles

1. **Calm.** Confident, present-tense, never hyped. We never say "revolutionary" or "AI-powered."
2. **Specific.** Name the meeting, the tool, the moment. _"The pricing call from Thursday,"_ not _"your conversations."_
3. **Portable.** Always name the destinations: Claude, ChatGPT, Gemini, Cursor. Layers does not gate you — Layers gives you context **for** the tools you already use.
4. **Inevitable.** Speak as if the central context library is obviously how this should already work. Because it is.
5. **Quiet humor when it fits.** A wry observation about retyping your project context for the tenth time today is fine. Slapstick is not.

### Tone words

- Calm, organic, structured, confident, inevitable, portable, layered, specific.

### Not tone words

- Hyped, revolutionary, AI-powered (cliché), magical (cliché), seamless (cliché), 10x, unlock, supercharge, dazzling, mind-blowing.

### Do

- _"Your meeting memory in every AI tool."_ (existing tagline — see `remotion/scenes/Mcp.tsx`)
- _"Tap once. Layered for life."_
- _"Your context, layered."_
- _"Claude knew about Thursday. We didn't have to tell it."_
- Specific verbs: capture, layer, recall, hand off, route, surface.

### Don't

- _"Layers is the future of knowledge work."_ — too grand, too vague.
- _"Layers magically gives your AI context."_ — magical is a cliché and dodges what we actually do.
- _"Unlock the power of your meetings."_ — cliché stack.
- Anything that pretends Layers is the destination instead of the substrate.

---

## 8. Real assets — non-negotiable

> **Rule:** When you need a real brand SVG, color, or font, **always reach for a skill, MCP, or cached asset first**. Never approximate. The skill `.claude/skills/layers-brand-remotion/SKILL.md` §5 owns the playbook; this section is the policy.

### Cached vendor assets (kept in sync at two paths)

The eight vendors we touch most are cached at `public/brand-icons/` (Remotion + Next.js) and `branding/icons/` (design kit + playground):

| Tool | Cached SVG | Source |
|---|---|---|
| Claude | `claude-color.svg` | `@lobehub/icons-static-svg` |
| ChatGPT / OpenAI | `openai.svg` | `@lobehub/icons-static-svg` |
| Gemini | `gemini-color.svg` | `@lobehub/icons-static-svg` |
| Cursor | `cursor.svg` | `@lobehub/icons-static-svg` |
| Anthropic | `anthropic.svg` | `@lobehub/icons-static-svg` |
| MCP | `mcp.svg` | `@lobehub/icons-static-svg` |
| Linear | `linear.svg` | SimpleIcons (LobeHub doesn't carry Linear) |
| Notion | `notion.svg` | SimpleIcons (LobeHub doesn't carry Notion) |

How to use them:

- **Remotion** — `<Img src={staticFile("brand-icons/claude-color.svg")} />`. Typed wrappers ship in `remotion/scenes/brand-template/vendor-logos.tsx`.
- **HTML kits** — `<img src="./icons/claude-color.svg" />`.
- **Next.js / product** — `<Image src="/brand-icons/claude-color.svg" alt="Claude" width={36} height={36} />`.

### For brands we don't have — context.dev MCP

Install the context.dev MCP server (free tier: 500 API credits + 10K Logo Link requests per month):

```bash
claude mcp add context.dev_mcp_api \
  --header "x-context-dev-api-key: $CONTEXT_DEV_KEY" \
  --transport http \
  https://context-dev.stlmcp.com
```

Use it to fetch the brand's logo, colors, and fonts by domain. Cache the result into `public/brand-icons/<slug>.svg` and add a row to the table above so the lookup happens once.

### Brand-resource pages — source of truth for usage rules

| Tool | Brand page |
|---|---|
| Claude | https://www.anthropic.com/brand |
| ChatGPT | https://openai.com/brand/ |
| Gemini | https://about.google/brand-resource-center/logos-list/ |
| Cursor | https://cursor.com/ |
| Linear | https://linear.app/brand |
| Notion | https://www.notion.com/ |
| MCP | https://modelcontextprotocol.io/ |

### Visual rules

- Use the **monogram**, not the wordmark, at small sizes.
- Maintain at least **1× mark-height** clearspace.
- **Never recolor** third-party marks to Layers colors. Our colors connect _to_ them; we don't make them ours.
- On Layers paper background, a **0.04-opacity mint halo** behind the mark is the only treatment allowed.
- For monochrome marks (OpenAI, Cursor, MCP), the SVG inherits `currentColor` — set the surrounding container's `color` to your foreground.

---

## 9. The five canonical narrative beats

Every Layers video, regardless of length, should be able to anchor to at least one of these:

1. **The wedge** — audio intake. Phone in hand at a Starbucks, tap, transcribe, done.
2. **The pan from face to dot** — you are the constant across all your tools; from above, you are a single mint dot.
3. **Layers accumulate** — concentric organic rings, each labeled with a context source.
4. **Context flows out** — your dot at center, organic lines connecting to real Claude/ChatGPT/Gemini/Cursor logos.
5. **Quiet outro** — the new organic mark + tagline on warm paper. No music swell. No "available now."

The default Remotion template (`remotion/scenes/brand-template/`) implements all five in sequence. Single-purpose videos can cut to one or two; never reorder.

---

## 10. Anti-patterns

- **Stock dashboards in screen recordings.** Use the actual product, or don't show a product surface. Never fake one with a generic SaaS UI.
- **AI sparkles everywhere.** The brand has _one_ flourish (`HandwrittenAccent` in `remotion/components/PaperBackground.tsx`). One is enough. Never three.
- **Generic motion-graphics easings.** Use `Easing.bezier(0.16, 1, 0.3, 1)` and `spring({ damping: 200 })` for primary moves. No bouncy overshoot on serious copy.
- **Loud music.** Music, when present, is `mp` or quieter. The voice is the lead.
- **Treating LLMs as competition.** They are the destination. Layers is the substrate.

---

## 11. References

- `DESIGN.md` — Paper Calm system, tokens, the source of truth for spacing/colors/motion.
- `branding/design-kit.html` — visual reference; share this when someone asks "what does Layers look like?"
- `branding/htmlcanvas-playground.html` — interactive demos of the five canonical beats.
- `remotion/scenes/brand-template/` — the canonical video template.
- `.claude/skills/layers-brand-remotion/SKILL.md` — agent skill that bundles all of the above.
- `components/audio-wave-ribbon.tsx` — the visual signature, in product code.
- `components/layers-logo.tsx` — current logo. Replacement variant lives in `design-kit.html` for now.

---

_Append-only. Edits to brand voice or visual rules must update this file, `DESIGN.md`, and `.ai-starter/manifests/design.json` together._
