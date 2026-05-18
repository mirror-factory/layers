# Remotion Video Guide

This is the non-Claude onboarding note for Layers video work. The canonical
Claude playbook is `.claude/skills/layers-brand-remotion/SKILL.md`; this file
keeps the important commands and quality checks visible to Codex, reviewers, and
humans.

## Compositions

The registry is `remotion/Root.tsx`.

| ID | Purpose | Source |
| --- | --- | --- |
| `Composition` | Main Layers product explainer | `remotion/Composition.tsx` |
| `MirrorFactoryIntro` | Mirror Factory intro bumper | `remotion/scenes/intro/IntroComposition.tsx` |
| `BrandTemplate` | Forkable 40-second brand/release template | `remotion/scenes/brand-template/BrandTemplateComposition.tsx` |

## Commands

```bash
pnpm video:dev
pnpm video:render
```

`pnpm video:render` renders `Composition` to
`out/layers-explainer.mp4`. The output directory is local evidence and should
not be treated as source.

## Brand Rules

- Use `remotion/lib/tokens.ts` for colors, radii, and font stacks.
- Use `FONT_EMPHASIS_SANS` for emphasis. Do not introduce serif display accents.
- Reuse `PaperBackground`, `AudioWave`, `LayersMark`, `ApertureLogo`, and `Card`
  from `remotion/components/`.
- Motion must be frame-deterministic: use `useCurrentFrame`, `interpolate`, and
  `spring`; do not use `Date.now`, `Math.random`, or request-animation-frame
  side effects.
- Vendor logos must come from the cached brand assets or be clearly marked as
  stand-ins.

## QA Checklist

Before using a video in release material:

- `pnpm typecheck`
- `pnpm video:render`
- Watch the rendered MP4 end to end.
- Check the render uses the same Paper Calm visual language as the app.
- Confirm no serif font usage with:

```bash
rg -n "serif|Georgia|Iowan|Charter|Playfair|FONT_ITALIC_SERIF" remotion .claude/skills/layers-brand-remotion docs/REMOTION.md
```

Historical evidence lives in `docs/evidence/2026-05-12-brand-kit/`.
