---
name: layers-brand-remotion
description: Use this skill any time the user asks to make a Layers-branded video, motion graphic, social asset, OpenGraph image, release reel, recap, brand mark animation, or anything involving the `remotion/` folder. Also use when the user mentions HTML-in-Canvas, organic waves, the audio-wave ribbon, the brand narrative (mint dot / layers / context flowing out), or the design kit. Bundles brand voice, Layers design tokens, Remotion authoring patterns, the brand template scenes, and Remotion's experimental `<HtmlInCanvas>` API into a single playbook so generated work matches the existing visual identity without drift.
---

# Layers — Brand + Remotion + HTML-in-Canvas

> Make Layers-branded video and motion content that matches the existing identity.
> Triggers on: video, motion graphic, brand asset, social card, release reel,
> Remotion, organic wave, HTML-in-Canvas, audio ribbon, brand narrative.

This skill bundles three things that always travel together:

1. **Brand voice + visual tokens** — so copy and color match the rest of the product.
2. **Remotion authoring patterns for Layers** — so you reuse `PaperBackground`, `AudioWave`, `LayersMark`, and the brand-template beats instead of reinventing them.
3. **HTML-in-Canvas patterns** — so you know when to reach for the `<HtmlInCanvas>` shader, what each effect signals narratively, and how to keep renders stable.

---

## 0. Read these first

Before generating any branded asset:

1. `branding/BRAND_NARRATIVE.md` — voice, narrative beats, do/don't copy, real-logo policy.
2. `DESIGN.md` — Paper Calm token system (source of truth for tokens).
3. `branding/design-kit.html` — visual reference, copy SVGs from here.
4. `branding/htmlcanvas-playground.html` — six live demos that match the brand narrative.
5. `remotion/scenes/brand-template/` — the canonical 40-second template you fork from.
6. `remotion/lib/tokens.ts` — frame-deterministic token export (do not duplicate values).
7. `remotion/components/{PaperBackground,AudioWave,LayersMark,ApertureLogo,Card}.tsx` — reusable primitives.

If you propose changing tokens, voice, or the narrative, update `BRAND_NARRATIVE.md` + `DESIGN.md` + `.ai-starter/manifests/design.json` together.

---

## 1. Brand recap (the 60-second version)

- **Layers is the central context library for knowledge workers — portable to any LLM.**
- Wedge: audio intake. End state: context library callable from Claude, ChatGPT, Gemini, Cursor.
- Visual metaphor: mint dot = you · organic violet ring = active context · organic blue ring = the library · organic motion = life isn't grid-perfect.
- Three signature colors carry the brand: **mint** (OKLCH `0.68 0.13 166` / `rgba(52, 211, 153)`), **violet** (`0.66 0.16 282` / indigo `rgba(99, 102, 241)` and soft `rgba(196, 181, 253)`), **blue** (`0.66 0.13 240`).
- Paper Calm surfaces — warm paper, never pure white.
- Voice: calm, specific, portable, inevitable, one quiet flourish per layout.

**Voice cheat sheet**

| Do | Don't |
|---|---|
| Specific verbs: capture, layer, recall, hand off, route, surface | "Unlock the power of" |
| Name destinations: Claude, ChatGPT, Gemini, Cursor | "AI-powered / magical / seamless" |
| Acknowledge reality of work (Starbucks meetings, Slack DMs, browser tabs) | "Revolutionary / 10x / supercharge" |
| Layers as substrate, LLMs as destination | Pretending Layers replaces the LLMs |

---

## 2. The five canonical narrative beats

Every Layers video should anchor to at least one of these. The brand template implements all five in order. Cut, never reorder.

1. **The wedge** — audio intake (`Wedge.tsx`)
2. **You are the dot** — pan from face to single dot (`FaceToDot.tsx`)
3. **Layers accumulate** — concentric organic rings labeled by source (`Layers.tsx`)
4. **Context flows out** — center dot, lines to vendor logos (`ContextFlow.tsx`)
5. **Quiet outro** — organic mark + tagline on paper, no music swell (`Outro.tsx`)

For a 15-second cut: pick two adjacent beats and the outro.
For an OpenGraph card: a single frame from `ContextFlow.tsx` or `Layers.tsx`.

---

## 3. Remotion authoring patterns (Layers-specific)

### Token import

```tsx
import { TOKENS, FONT_EMPHASIS_SANS } from "../../lib/tokens";
```

Never import from `app/styles/tokens.css` or hard-code OKLCH/hex in Remotion code. The values in `remotion/lib/tokens.ts` are the single source.

### Always wrap scenes in `<PaperBackground>`

```tsx
import { PaperBackground } from "../../components/PaperBackground";

<AbsoluteFill>
  <PaperBackground />
  {/* scene content */}
</AbsoluteFill>
```

Paper Calm is the brand. Don't ship a Layers scene on a flat color.

### Reuse the existing primitives

| Need | Use |
|---|---|
| Wave ribbon | `<AudioWave width={...} height={...} level={0.3} motion={1} />` from `remotion/components/AudioWave.tsx` |
| Logo mark | `<LayersMark size={64} />` from `remotion/components/LayersMark.tsx` (arc variant — current production logo) |
| Organic logo (proposed) | `<OrganicLayersMark phase={seconds * 0.8} size={120} />` from `remotion/scenes/brand-template/OrganicRing.tsx` — only use after design approval |
| Paper card chrome | `<Card>` + `<CardHeader>` from `remotion/components/Card.tsx` |
| One handwritten flourish per video | `<HandwrittenAccent label="exactly." progress={0.4 + 0.6 * (frame/30)} />` from `PaperBackground.tsx` |
| Sans emphasis | `style={{ fontFamily: FONT_EMPHASIS_SANS, fontWeight: 650, color: TOKENS.layersMint }}` |
| Concentric organic rings | `<OrganicRing cx cy baseR amp lobesA lobesB phase stroke />` |

### Frame-deterministic motion only

```tsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();
const seconds = frame / fps;

// Good — pure function of frame
const x = interpolate(frame, [0, 30], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const drift = Math.sin(seconds * 1.4) * 12;

// Bad — Date.now / Math.random / requestAnimationFrame side effects
```

Helpers:

```tsx
function clampFade(frame: number, start: number, fadeFrames = 18): number {
  return interpolate(frame, [start, start + fadeFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
```

For spring-driven entrances:

```tsx
import { spring } from "remotion";
const e = spring({ fps, frame, config: { damping: 200 }, durationInFrames: 30 });
```

### Sequence boundaries get half-second crossfades

The brand template overlaps adjacent beats by ~20 frames so motion never hard-cuts. Mirror that pattern in any fork:

```ts
// timing.ts
export const BEATS = {
  coldOpen:   { from:   0, duration: 120 },
  wedge:      { from: 100, duration: 240 },   // overlap by 20 frames
  // ...
};
```

Each scene clamps its own `enter` and `out` opacities so the crossover is smooth.

### Fonts

- Display/UI sans: use `FONT_EMPHASIS_SANS` or the system stack. Layers does not use serif display accents.
- Mono: JetBrains Mono → SF Mono → ui-monospace for tool calls, transcripts, code reveals.

### Don't add background music to the template

`MirrorFactoryIntro` and `BrandTemplate` ship voice-first. If a fork needs music, set it `mp` or quieter via `<Audio volume={0.18} />`.

---

## 4. HTML-in-Canvas — when and how

Remotion `v4.0.455+` ships `<HtmlInCanvas>` (we're on `^4.0.459`). It wraps the WICG `html-in-canvas` draft so a live DOM node can be painted into a `<canvas>` and post-processed with Canvas 2D or WebGL2. Preview needs Chrome Canary 149+ with `chrome://flags/#canvas-draw-element`; renders work everywhere because Remotion ships a patched Chrome.

### Always gate behind `HtmlInCanvas.isSupported()`

```tsx
import { HtmlInCanvas } from "remotion";

if (HtmlInCanvas.isSupported()) {
  return <HtmlInCanvas width={1920} height={1080} onInit={initGl} onPaint={paintGl}>
    {/* DOM that should be post-processed */}
  </HtmlInCanvas>;
}
return <PlainSvgFallback />;
```

The brand template (`remotion/scenes/brand-template/`) deliberately uses **SVG/CSS only** so it renders identically in every environment. Bolt HtmlInCanvas effects onto forks when the narrative needs them.

### Which effect for which beat

| Effect | Repo demo | When to use it in Layers |
|---|---|---|
| **Magnifier** (lens-warp) | `remotion-dev/html-in-canvas/src/MagnifyingGlass/` | Focus on a transcript word — "the pricing call from Thursday." Use over a paper-styled transcript paragraph. |
| **Paper-grain + halftone bars** | `src/CenteredWhitePaper/` | A proof / stat card with **one** bar in Layers blue. "Hours of context captured, last six months." |
| **CRT terminal** | `src/Crt/` | A code-reveal moment for developer content — a fake `claude code` session, an `mcp inspect` run. |
| **Vintage post-processing** | `src/Vintage/` | Archival / "look how long context has been a problem" framing. Pairs with a real `<Video>` clip. |
| **Article-highlight (yellow marker)** | `src/ArticleHighlight/` | Highlight a key sentence in a meeting transcript or a customer email screenshot. |
| **Cube transition / store-peel** | `src/CubeTransitionCard/` | Between two scenes that need a hand-off feeling (rare — only use for big launches). |

For the magnifier in a brand fork, the minimal scaffold:

```tsx
import { HtmlInCanvas, type HtmlInCanvasOnPaint, useCurrentFrame } from "remotion";
import { useCallback } from "react";

export const MagnifyTranscript: React.FC = () => {
  const frame = useCurrentFrame();
  const onPaint: HtmlInCanvasOnPaint = useCallback(({ canvas, element, elementImage }) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to acquire 2D context");
    const blurPx = 0;            // magnifier doesn't blur — use a clip + zoom
    ctx.reset();
    ctx.filter = `blur(${blurPx}px)`;
    const transform = ctx.drawElementImage(elementImage, 0, 0);
    element.style.transform = transform.toString();  // keep DOM hit-testing aligned
    // Then: clip to a circle and re-drawImage with a scaled crop.
  }, [frame]);

  return (
    <HtmlInCanvas width={1920} height={1080} onPaint={onPaint}>
      <TranscriptParagraph />
    </HtmlInCanvas>
  );
};
```

### Hard rules

- **No nesting.** `<HtmlInCanvas>` inside another `<HtmlInCanvas>` throws.
- **Reassign the transform.** Always set `element.style.transform = transform.toString()` after `drawElementImage`, or DOM hit-testing desyncs.
- **Cleanup in `onInit`.** Return a function that deletes WebGL programs, textures, buffers — long renders will leak GPU memory otherwise.
- **WebGL needs `--gl=angle`.** For renders: `npx remotion render --gl=angle`, or `Config.setChromiumOpenGlRenderer('angle')` in `remotion.config.ts`. Lambda defaults to `swangle`.
- **API is unstable.** Chrome may change it. Keep effects bolted on as forks, never the spine of the template.
- **Don't combine** `<HtmlInCanvas>` with `@remotion/web-renderer`'s `allowHtmlInCanvas` mode — same no-nesting rule applies.

### Performance pattern

One `<HtmlInCanvas>` per logical layer (paper / title / each bar in a chart), **not** one giant canvas. Each pipeline stays tight and the GPU memory stays low. The official paper-grain bar chart demo does this — paper sheet is one HtmlInCanvas, title is another, each bar is its own.

---

## 5. Real-asset policy — never approximate

> **Rule:** When you need a real brand SVG, logo, color, or font, **always reach for a skill, an MCP, or a cached asset first**. Never approximate. Never inline a hand-drawn shape "in the spirit of" the vendor mark — designers and the user can tell at a glance.

### 5.1 Layers asset registry — cached locally

All seven vendors we touch already have their canonical SVGs cached in **two locations** (kept in sync; if you update one, mirror the other):

| Vendor | Cached path | Source |
|---|---|---|
| Claude | `public/brand-icons/claude-color.svg` · `branding/icons/claude-color.svg` | `@lobehub/icons-static-svg` |
| OpenAI / ChatGPT | `…/openai.svg` | `@lobehub/icons-static-svg` |
| Gemini | `…/gemini-color.svg` | `@lobehub/icons-static-svg` |
| Cursor | `…/cursor.svg` | `@lobehub/icons-static-svg` |
| Anthropic | `…/anthropic.svg` | `@lobehub/icons-static-svg` |
| MCP | `…/mcp.svg` | `@lobehub/icons-static-svg` |
| Linear | `…/linear.svg` | SimpleIcons (LobeHub doesn't carry it) |
| Notion | `…/notion.svg` | SimpleIcons (LobeHub doesn't carry it) |

How to use them:

- **In Remotion**: `<Img src={staticFile("brand-icons/claude-color.svg")} />` — the typed wrappers in `remotion/scenes/brand-template/vendor-logos.tsx` (`ClaudeLogo`, `ChatGptLogo`, `GeminiLogo`, `CursorLogo`, `McpLogo`, `LinearLogo`, `NotionLogo`) already do this.
- **In HTML (design kit / playground / OG cards)**: `<img src="./icons/claude-color.svg" />` if next to `branding/`, else `<img src="/brand-icons/claude-color.svg" />` if served from `public/`.
- **In product / Next.js code**: `<Image src="/brand-icons/claude-color.svg" alt="Claude" width={36} height={36} />`.

### 5.2 Refreshing from canonical sources

Run from repo root when LobeHub or SimpleIcons ships an update (treat as a quarterly chore; no automation yet):

```bash
cd public/brand-icons
for slug in claude-color openai gemini-color cursor anthropic mcp; do
  curl -sL -o "$slug.svg" "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/$slug.svg"
done
curl -sL -o linear.svg "https://cdn.simpleicons.org/linear/5e6ad2"
curl -sL -o notion.svg "https://cdn.simpleicons.org/notion/0b0c0e"
cp ./*.svg ../../branding/icons/
```

CDN URL patterns you can use directly without caching (slower for renders, fine for HTML preview):

```
https://unpkg.com/@lobehub/icons-static-svg@latest/icons/<slug>.svg
https://unpkg.com/@lobehub/icons-static-svg@latest/icons/<slug>-color.svg
https://cdn.simpleicons.org/<slug>
https://cdn.simpleicons.org/<slug>/<hex-color>
```

### 5.3 New brands — use the context.dev MCP

For any brand **not** in the registry above, do not approximate. Install the context.dev MCP server (free tier, 500 API credits + 10K Logo Link requests per month):

```bash
claude mcp add context.dev_mcp_api \
  --header "x-context-dev-api-key: $CONTEXT_DEV_KEY" \
  --transport http \
  https://context-dev.stlmcp.com
```

Then ask it to fetch the brand's logo + brand colors + fonts by domain. Cache the result into `public/brand-icons/<slug>.svg` and add a row to §5.1 above so we don't pay for the same lookup twice.

### 5.4 Visual rules

- Use the **monogram**, not the wordmark, at small sizes. Wordmark only when the asset is specifically a "Layers + Claude" co-mark moment.
- Maintain at least **1× mark-height clearspace** around any third-party logo.
- **Never recolor** third-party marks. Our brand colors connect _to_ them; we don't make them ours.
- On Layers paper background, a **0.04-opacity mint halo** behind the mark is the only treatment allowed.
- For OpenAI / Cursor / MCP marks on a dark background, the LobeHub SVG inherits `currentColor` — set the surrounding container's `color` to your foreground value.

### 5.5 Where the canonical brand pages still matter

Even with cached SVGs, the **brand-resource pages** are the source of truth for sizing, clearspace, and recolor policy. Cite when committing:

- Claude — https://www.anthropic.com/brand
- ChatGPT / OpenAI — https://openai.com/brand/
- Gemini — https://about.google/brand-resource-center/logos-list/
- Cursor — https://cursor.com/
- Linear — https://linear.app/brand
- Notion — https://www.notion.com/
- MCP — https://modelcontextprotocol.io/

---

## 6. Workflow

For a new branded video:

1. Read `BRAND_NARRATIVE.md` §2-§5 — anchor on one or more of the five narrative beats.
2. Copy `remotion/scenes/brand-template/` to `remotion/scenes/<your-video>/`.
3. Update `timing.ts` for the new run length.
4. Edit / replace beats as needed. Keep `<PaperBackground>` as the floor.
5. Register the composition in `remotion/Root.tsx`. Add `id`, `durationInFrames` from your timing, `fps` (use 30), `width: 1920`, `height: 1080` (or 1080×1920 for vertical, 1080×1080 for square).
6. Preview: `npx remotion studio`. Confirm motion reads at full speed.
7. Render: `npx remotion render BrandTemplate out/<your-video>.mp4`. Add `--gl=angle` if any HtmlInCanvas effects are in play.
8. For a still: `npx remotion still BrandTemplate --frame=480 out/og.png` — picks the first frame of beat 4 (layers).
9. Append to `docs/ACTIVITY_LOG.md` under the matching event type (e.g. `doc-shipped` or `pr-merged`).

For a branded still (OpenGraph / social card):

1. Use `npx remotion still BrandTemplate --frame=N` with N picked from `BEATS.layers.from` or `BEATS.contextFlow.from`.
2. For a custom card, write a new composition at `1200×630` (OG) or `1080×1080` (square) that imports the same primitives.

---

## 7. Checklist before shipping

- [ ] Tokens come from `remotion/lib/tokens.ts`, not raw hex/OKLCH.
- [ ] `<PaperBackground>` is in the scene.
- [ ] No serif display accents; emphasis uses sans weight, color, and spacing.
- [ ] One `<HandwrittenAccent>` (or zero), not two.
- [ ] Voice matches `BRAND_NARRATIVE.md` §7 (specific verbs, named destinations).
- [ ] Vendor logos use real canonical SVGs (or are marked as stand-ins).
- [ ] Composition registered in `remotion/Root.tsx`.
- [ ] `pnpm typecheck` passes.
- [ ] HtmlInCanvas effects are gated by `HtmlInCanvas.isSupported()` with a non-shader fallback.
- [ ] If WebGL: `--gl=angle` documented for the render command.
- [ ] Activity log appended (`doc-shipped` / `pr-merged` with the matching model line).

---

## 8. References

| Source | Why |
|---|---|
| `branding/BRAND_NARRATIVE.md` | Voice, narrative, real-logo policy |
| `branding/design-kit.html` | Shareable visual reference, copy SVGs |
| `branding/htmlcanvas-playground.html` | Six demos of the brand-narrative beats |
| `DESIGN.md` | Paper Calm token system |
| `remotion/lib/tokens.ts` | Frame-deterministic tokens |
| `remotion/components/AudioWave.tsx` | The signature ribbon, deterministic |
| `remotion/components/PaperBackground.tsx` | Standard background + handwritten accent |
| `remotion/scenes/brand-template/` | The canonical template — fork it |
| Remotion docs — `<HtmlInCanvas>` | https://www.remotion.dev/docs/remotion/html-in-canvas |
| WICG html-in-canvas | https://github.com/WICG/html-in-canvas |
| Remotion HTML-in-Canvas examples repo | https://github.com/remotion-dev/html-in-canvas |
| Linear parent | PROD-496 (`Brand Kit + Remotion Template + HTML-in-Canvas Skill`) |
