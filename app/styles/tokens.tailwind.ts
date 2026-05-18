/**
 * tokens.tailwind.ts -- AUTO-GENERATED from .ai-dev-kit/registries/design-tokens.yaml
 * Merge into your tailwind.config:
 *   import { tokens } from './app/styles/tokens.tailwind';
 *   export default { theme: { extend: tokens }, ... };
 */

export const tokens = {
  colors: {
    "layers": {
      "violet": "oklch(0.66 0.16 282)",
      "mint": "oklch(0.68 0.13 166)",
      "blue": "oklch(0.66 0.13 240)",
      "violet-soft": "oklch(0.78 0.13 282)",
      "mint-soft": "oklch(0.82 0.10 168)",
      "blue-soft": "oklch(0.80 0.09 240)",
      "violet-tint": "oklch(0.95 0.03 284)",
      "mint-tint": "oklch(0.95 0.04 168)",
      "blue-tint": "oklch(0.94 0.03 240)",
      "ink": "oklch(0.22 0.035 256)",
      "paper": "oklch(0.985 0.012 168)"
    },
    "brand": {
      "accent": "var(--layers-mint)",
      "accent-subtle": "oklch(0.56 0.12 170)",
      "accent-muted": "oklch(0.32 0.07 170)",
      "accent-light": "var(--layers-mint-soft)"
    },
    "ink": {
      "50": "oklch(0.985 0.008 256)",
      "200": "oklch(0.84 0.014 256)",
      "400": "oklch(0.63 0.018 256)",
      "600": "oklch(0.44 0.025 256)",
      "800": "oklch(0.28 0.03 256)",
      "950": "oklch(0.18 0.035 256)"
    },
    "signal": {
      "live": "oklch(0.64 0.20 26)",
      "success": "oklch(0.68 0.13 166)",
      "warning": "oklch(0.74 0.14 74)",
      "info": "oklch(0.66 0.13 240)"
    },
    "semantic": {
      "success": "var(--signal-success)",
      "error": "var(--signal-live)",
      "warning": "var(--signal-warning)",
      "info": "var(--signal-info)"
    },
    "bg": {
      "page": "oklch(0.982 0.012 168)",
      "surface": "oklch(0.997 0.004 168)",
      "surface-muted": "oklch(0.957 0.018 168)",
      "surface-2": "oklch(0.935 0.018 168)",
      "page-tint-1": "oklch(0.95 0.03 284 / 0.72)",
      "page-tint-2": "oklch(0.95 0.04 168 / 0.62)"
    },
    "fg": {
      "default": "var(--layers-ink)",
      "muted": "oklch(0.46 0.025 256)",
      "subtle": "oklch(0.58 0.02 256)",
      "faint": "oklch(0.67 0.018 256)"
    },
    "border": {
      "default": "oklch(0.84 0.024 168 / 0.74)",
      "subtle": "oklch(0.84 0.024 168 / 0.46)"
    },
    "light": {
      "bg-primary": "var(--bg-page)",
      "bg-secondary": "var(--bg-surface-muted)",
      "text-primary": "var(--fg-default)",
      "text-secondary": "var(--fg-muted)"
    }
  },
  spacing: {
    "space-1": "4px",
    "space-2": "8px",
    "space-3": "12px",
    "space-4": "16px",
    "space-5": "20px",
    "space-6": "24px",
    "space-8": "32px",
    "space-10": "40px",
    "space-12": "48px",
    "space-16": "64px",
    "space-20": "80px",
    "space-24": "96px"
  },
  borderRadius: {
    "xs": "4px",
    "sm": "6px",
    "md": "10px",
    "lg": "14px",
    "xl": "20px",
    "2xl": "28px",
    "pill": "9999px",
    "full": "9999px"
  },
  boxShadow: {
    "xs": "0 1px 2px oklch(0.22 0.035 256 / 0.05)",
    "sm": "0 8px 24px oklch(0.22 0.035 256 / 0.07)",
    "md": "0 18px 50px oklch(0.22 0.035 256 / 0.10)",
    "lg": "0 28px 80px oklch(0.22 0.035 256 / 0.14)",
    "glow-mint": "0 0 28px oklch(0.68 0.13 166 / 0.20)"
  },
  screens: {
    "mobile": "0px",
    "tablet": "768px",
    "desktop": "1024px",
    "wide": "1440px"
  },
} as const;
