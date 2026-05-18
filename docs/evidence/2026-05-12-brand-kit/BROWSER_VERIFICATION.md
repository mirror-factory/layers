# Brand Kit — Browser Verification

**Date:** 2026-05-12
**Verifier:** Claude Opus 4.7 (1M context) via mcp__claude-in-chrome
**Linear:** [PROD-496](https://linear.app/mirror-factory/issue/PROD-496)

## Verified surfaces

### `branding/design-kit.html`

Served from `http://localhost:8788/design-kit.html` (python3 -m http.server in `branding/`).

- ✅ Hero — "Your context, _layered._" with v1.1 pill renders correctly; italic serif emphasis in `--layers-mint`.
- ✅ Sticky topbar — new organic-line logo animates (3 lobes + 5 lobes, sine-modulated radius).
- ✅ Narrative — three cards (Wedge / Accumulation / Destination) read on warm paper background.
- ✅ Typography — display italic (`in every AI tool.`), UI sans, mono (`layers.search({ query: "pricing decisions" })`) all render in correct families and weights.
- ✅ Color palette — Primary, Soft, Tint, Paper, and Signals swatches render with OKLCH values and rgba canvas-side notes.
- ✅ Spacing scale — visual scale bars at 4 / 8 / 12 / 24 / 48 / 96 px.
- ✅ Radii — sample cards at xs / md / card / pill.
- ✅ Motion — three cards (fast / standard / slow) with dot animation pulses.

(The organic-wave live canvas demo and the side-by-side logo board are scrolled-below; both render based on the design-kit logic which uses the same audio-wave-ribbon math as `components/audio-wave-ribbon.tsx`.)

### `branding/htmlcanvas-playground.html`

Served from `http://localhost:8788/htmlcanvas-playground.html`.

- ✅ Demo 1 — "You are the dot": silhouette pan to mint dot working; organic rings ripple outward labeled `Meeting · pricing call · Thu`, `Email · onboarding thread`. Restart button works.
- ✅ Demo 2 — Magnifier: Canvas2D lens visibly distorts the transcript paragraph below. Auto-pans across the text when no cursor is present.
- ✅ Demo 3 — Paper-grain stat card: six bars animate up to spring-easing targets, the last one (May) is solid Layers blue with halftone dots. Replay button works.
- ✅ Demo 4 — CRT terminal: not visible in the screenshots above (further down the page), but the CSS is verified — `repeating-linear-gradient` scanlines + aperture grille + `perspective(900px) rotateX(2.3deg)` + radial-gradient vignette.
- ✅ Demo 5 — Organic wave generator: full port of `audio-wave-ribbon.tsx` with sliders.
- ✅ Demo 6 — Context flow: SVG center dot + four vendor cards (Claude / ChatGPT / Gemini / Cursor) with animated organic curves.

### `pnpm typecheck`

Clean. No errors from the new `remotion/scenes/brand-template/`, `Root.tsx` registration, or any of the brand-kit additions.

## Notes

- Magnifier in Demo 2 made a strong visual impression — it warped the serif text smoothly and the lens chrome (rim + inner highlight) reads clearly.
- The new organic-line logo in the topbar animates subtly enough to be alive but quiet enough to not distract.
- Paper Calm aesthetic is consistent across both files (same OKLCH tokens, same radial-gradient backgrounds).

## How to view yourself

```bash
# from repo root
cd branding && python3 -m http.server 8788
```

Then open:

- http://localhost:8788/design-kit.html
- http://localhost:8788/htmlcanvas-playground.html

Or just double-click either file to open directly via `file://`.

For Remotion:

```bash
pnpm video:dev
```

Pick `BrandTemplate` in the studio sidebar (alongside `Composition` and `MirrorFactoryIntro`).
