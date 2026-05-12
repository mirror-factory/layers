/**
 * Layers brand tokens for Remotion.
 *
 * Chromium (which Remotion renders with) supports `oklch()`, but we mirror the
 * canonical hex equivalents alongside so any tooling that doesn't (e.g. some
 * thumbnail extractors) still gets a faithful color. Source of truth lives in
 * DESIGN.md and app/globals.css. Do not invent new values here.
 */

export const TOKENS = {
  // Brand
  layersMint: "oklch(0.68 0.13 166)",
  layersMintSoft: "oklch(0.82 0.10 168)",
  layersMintTint: "oklch(0.95 0.04 168)",
  layersViolet: "oklch(0.66 0.16 282)",
  layersVioletSoft: "oklch(0.78 0.13 282)",
  layersVioletTint: "oklch(0.95 0.03 284)",
  layersBlue: "oklch(0.66 0.13 240)",
  layersBlueSoft: "oklch(0.80 0.09 240)",

  // Paper Calm surfaces (light mode — the brand's canonical palette)
  bgPage: "oklch(0.982 0.012 168)",
  bgSurface: "oklch(0.997 0.004 168)",
  bgSurfaceMuted: "oklch(0.972 0.014 168)",

  ink: "oklch(0.22 0.035 256)",
  fgMuted: "oklch(0.46 0.025 256)",
  fgFaint: "oklch(0.62 0.025 256)",

  borderDefault: "oklch(0.84 0.024 168 / 0.74)",
  borderSubtle: "oklch(0.84 0.024 168 / 0.46)",

  // Signals
  danger: "oklch(0.64 0.20 26)",
  warning: "oklch(0.74 0.14 74)",
} as const;

export const RADII = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  card: 24,
  pill: 9999,
} as const;

/**
 * Italic display family — the brand uses a quiet serif italic for emphasis
 * (see app/(public)/landing.tsx: "home-italic-serif"). Iowan / Charter ship
 * with Chromium on macOS; we fall back through to Georgia as the universal
 * serif. Display sans loads in remotion/Root.tsx via @remotion/google-fonts.
 */
export const FONT_ITALIC_SERIF = `"Iowan Old Style", "Charter", "Georgia", serif`;
