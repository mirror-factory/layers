---
version: 1
name: "Layers Design System"
status: active
updated: "2026-05-01"
owners:
  - "Project team"
audience:
  - "product team"
  - "engineers"
  - "Codex agents"
tokens:
  colors:
    layersViolet: "oklch(0.66 0.16 282)"
    layersMint: "oklch(0.68 0.13 166)"
    layersBlue: "oklch(0.66 0.13 240)"
    layersVioletSoft: "oklch(0.78 0.13 282)"
    layersMintSoft: "oklch(0.82 0.10 168)"
    layersBlueSoft: "oklch(0.80 0.09 240)"
    layersVioletTint: "oklch(0.95 0.03 284)"
    layersMintTint: "oklch(0.95 0.04 168)"
    layersBlueTint: "oklch(0.94 0.03 240)"
    ink: "oklch(0.22 0.035 256)"
    paper: "oklch(0.982 0.012 168)"
    surface: "oklch(0.997 0.004 168)"
    line: "oklch(0.84 0.024 168 / 0.74)"
    muted: "oklch(0.46 0.025 256)"
    success: "oklch(0.68 0.13 166)"
    warning: "oklch(0.74 0.14 74)"
    danger: "oklch(0.64 0.20 26)"
  spacing:
    grid: "4px"
    compact: "8px"
    field: "12px"
    panel: "24px"
    section: "48px"
    stage: "96px"
  radii:
    xs: "4px"
    sm: "6px"
    md: "10px"
    lg: "14px"
    xl: "20px"
    card: "24px"
    pill: "9999px"
  motion:
    fast: "140ms cubic-bezier(0.22, 1, 0.36, 1)"
    standard: "220ms cubic-bezier(0.22, 1, 0.36, 1)"
    slow: "420ms cubic-bezier(0.22, 1, 0.36, 1)"
---

# Layers Design System

This file is the repo source for design intent. It is meant for humans and agents.

It follows the same idea as Google's `design.md` proposal: structured front matter for machines, Markdown rationale for humans, and a stable file agents can read before UI work.

The runtime design registry lives at `.ai-starter/manifests/design.json`. The control plane reads that registry. This file explains the why behind the tokens and gives agents rules before they change UI.

## Product Feel

Layers uses the v1.0 Paper Calm system from `/Users/alfonso/Downloads/Layers Design System.html`.

- Calm: enough visual energy to feel alive, never loud.
- Organic: soft paper surfaces, natural spacing, and warm neutrals.
- Structured: 4pt grid, predictable controls, explicit component states.
- Confident: mint is the primary accent, supported by violet and blue.
- Inevitable: do not invent values. If a color, size, radius, or shadow is missing from the token registry, propose it before shipping it.

The canonical mark is the Layers aperture: blue outer arc, violet middle arc, and mint center dot. Use `components/layers-logo.tsx` instead of creating page-specific marks.

## Design Inputs

Design state should be captured in repo files:

- `DESIGN.md`: intent, tone, token names, and agent-facing rules.
- `.ai-starter/manifests/design.json`: machine-readable design registry.
- `.ai-dev-kit/registries/design-tokens.yaml`: token source that generates CSS and Tailwind token exports.
- `.ai-dev-kit/registries/design-system.yaml`: component and primitive contract.
- `components/layers-logo.tsx`: canonical Layers logo primitive.
- `lib/project.config.ts`: project preferences and enabled integrations.
- `components/*.stories.tsx`: component-level design examples.
- `tests/e2e/*.visual.test.ts`: visual proof.
- `tests/expect/*.md`: natural-language browser checks.

## Design Flow

1. Capture or update design intent in this file.
2. Update `.ai-dev-kit/registries/design-tokens.yaml` and `.ai-dev-kit/registries/design-system.yaml`.
3. Run `pnpm exec tsx scripts/generate-theme-css.ts` to refresh `app/styles/tokens.css` and `app/styles/tokens.tailwind.ts`.
4. Add or update Storybook stories.
5. Add or update visual tests and Expect flows.
6. Run `pnpm sync` when starter automation is enabled, then `pnpm typecheck` and browser proof.
7. Inspect the changed routes in-browser.

## Agent Rules

Before changing UI, read:

- `DESIGN.md`
- `.ai-starter/manifests/design.json`
- relevant component stories
- relevant visual tests
- latest screenshot or browser-proof evidence

Do not claim visual quality without screenshot or browser evidence.

Use semantic Layers tokens (`--layers-*`, `--bg-*`, `--fg-*`, `--border-*`, `--signal-*`) and shared primitives before adding local values. Product UI should not use raw brand hex colors. Email and document exports may use email/PDF-safe fallbacks, but those fallbacks must be named as Layers design values.

## Current Limitations

Dashboard editing, image/URL design intake, automatic token extraction, and design drift enforcement are roadmap items. The reliable current path is repo-file first.

<!-- AI_STARTER_SETUP_DESIGN_START -->

## Starter Setup Design Contract

- Brand summary: Layers Design System v1.0, Paper Calm. Calm paper surfaces, structured controls, mint primary accent, violet and blue support colors, canonical aperture logo.
- Visual style: paper-calm
- Interaction style: Clear task-first flows with visible feedback and recoverable states.
- Density: medium
- Motion level: organic-subtle
- Brand colors: oklch(0.68 0.13 166), oklch(0.66 0.16 282), oklch(0.66 0.13 240)
- Reference systems: Layers Design System v1.0 - Paper Calm
- Accessibility: WCAG AA contrast, keyboard reachability, visible focus, and reduced-motion support.
- Design input source: /Users/alfonso/Downloads/Layers Design System.html
- Drift policy: warn
- Expect browser proof required: no

Design changes should update this contract, `.ai-starter/config.json`, and `.ai-starter/manifests/design.json` together.

<!-- AI_STARTER_SETUP_DESIGN_END -->
