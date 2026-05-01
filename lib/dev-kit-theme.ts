/**
 * dev-kit theme loader -- hydrates the /dev-kit dashboard with the project's
 * design tokens so the dashboard itself demonstrates brand enforcement.
 *
 * Source of truth: `.ai-dev-kit/registries/design-tokens.yaml`.
 * The file is read once at module-init time and memoized in a module-level
 * Map. Server components call `getDevKitTheme()` freely; re-reading the YAML
 * on every render would be wasteful and the file only changes at build time.
 *
 * Fallback strategy:
 *   - Missing file          -> full default theme (Layers Paper Calm).
 *   - File present, empty   -> full default theme.
 *   - Some tokens declared  -> declared values override defaults; the rest
 *                              fall back so the dashboard never renders with
 *                              undefined colors.
 *
 * Token name mapping (YAML key -> theme slot):
 *   colors.brand.accent / colors.layers.mint -> colors.primary
 *   colors.fg.default / colors.ink.950       -> colors.text
 *   colors.fg.muted / colors.ink.600         -> colors.textMuted
 *   colors.bg.page                           -> colors.bg
 *   colors.bg.surface                        -> colors.surface
 *   colors.border.default                    -> colors.border
 *   colors.signal.success                    -> colors.success
 *   colors.signal.warning                    -> colors.warn
 *   colors.signal.live                       -> colors.error
 *   typography.font.sans   -> font.sans
 *   typography.font.mono   -> font.mono
 *   spacing.space.1..8     -> space(n)
 *   radius.radius.sm|md|lg -> radius(size)
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DevKitTheme {
  colors: {
    primary: string;
    text: string;
    textMuted: string;
    bg: string;
    surface: string;
    border: string;
    success: string;
    warn: string;
    error: string;
  };
  font: {
    sans: string;
    mono: string;
  };
  space: (step: 1 | 2 | 3 | 4 | 6 | 8) => string;
  radius: (size: 'sm' | 'md' | 'lg') => string;
}

// Layers Paper Calm defaults. These mirror `.ai-dev-kit/registries/design-tokens.yaml`
// so fallback dashboard surfaces still honor the product brand.
const DEFAULT_COLORS: DevKitTheme['colors'] = {
  primary: 'oklch(0.68 0.13 166)',
  text: 'oklch(0.22 0.035 256)',
  textMuted: 'oklch(0.46 0.025 256)',
  bg: 'oklch(0.982 0.012 168)',
  surface: 'oklch(0.997 0.004 168)',
  border: 'oklch(0.84 0.024 168 / 0.74)',
  success: 'oklch(0.68 0.13 166)',
  warn: 'oklch(0.74 0.14 74)',
  error: 'oklch(0.64 0.20 26)',
};

const DEFAULT_FONTS: DevKitTheme['font'] = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
};

const DEFAULT_SPACE: Record<1 | 2 | 3 | 4 | 6 | 8, string> = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  6: '1.5rem',
  8: '2rem',
};

const DEFAULT_RADII: Record<'sm' | 'md' | 'lg', string> = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '1rem',
};

// Module-level cache. Keyed by absolute tokens-file path so different cwds
// (tests, monorepos) don't cross-contaminate.
const themeCache = new Map<string, DevKitTheme>();

const TOKEN_KEY_MAP: Record<string, keyof DevKitTheme['colors']> = {
  'layers.mint': 'primary',
  'brand.accent': 'primary',
  'brand.primary': 'primary',
  'fg.default': 'text',
  'ink.950': 'text',
  'text.primary': 'text',
  'fg.muted': 'textMuted',
  'ink.600': 'textMuted',
  'text.muted': 'textMuted',
  'bg.page': 'bg',
  'bg.default': 'bg',
  'bg.surface': 'surface',
  'surface.default': 'surface',
  'border.default': 'border',
  'signal.success': 'success',
  'state.success': 'success',
  'signal.warning': 'warn',
  'state.warn': 'warn',
  'signal.live': 'error',
  'state.error': 'error',
};

interface ParsedTokens {
  colors: Partial<Record<keyof DevKitTheme['colors'], string>>;
  fontSans?: string;
  fontMono?: string;
  space: Partial<Record<1 | 2 | 3 | 4 | 6 | 8, string>>;
  radius: Partial<Record<'sm' | 'md' | 'lg', string>>;
}

/**
 * Tiny YAML reader scoped to design-tokens.yaml. We parse only the shapes
 * this file declares (kind / schema_version / top-level sections with
 * "key: value" children) so we can avoid a yaml dependency in the kit's
 * consumer projects.
 */
function parseTokens(src: string): ParsedTokens {
  const out: ParsedTokens = { colors: {}, space: {}, radius: {} };

  let section: string | null = null;
  for (const raw of src.split('\n')) {
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const topLevel = line.match(/^([a-z_]+):\s*$/);
    if (topLevel) {
      section = topLevel[1] ?? null;
      continue;
    }
    if (!section) continue;

    const kv = line.match(/^\s+([a-z0-9_.]+):\s*(.+)$/i);
    if (!kv) continue;
    const key = (kv[1] ?? '').trim();
    const rawVal = (kv[2] ?? '').trim().replace(/^["']|["']$/g, '');

    if (section === 'colors') {
      const slot = TOKEN_KEY_MAP[key];
      if (slot) out.colors[slot] = rawVal;
    } else if (section === 'typography') {
      if (key === 'font.sans') out.fontSans = rawVal;
      else if (key === 'font.mono') out.fontMono = rawVal;
    } else if (section === 'spacing') {
      const m = key.match(/^space\.(\d)$/);
      if (m) {
        const n = Number(m[1]);
        if (n === 1 || n === 2 || n === 3 || n === 4 || n === 6 || n === 8) {
          out.space[n] = rawVal;
        }
      }
    } else if (section === 'radius') {
      const m = key.match(/^radius\.(sm|md|lg)$/);
      if (m) out.radius[m[1] as 'sm' | 'md' | 'lg'] = rawVal;
    }
  }
  return out;
}

function buildTheme(parsed: ParsedTokens): DevKitTheme {
  const colors: DevKitTheme['colors'] = { ...DEFAULT_COLORS, ...parsed.colors };
  const font: DevKitTheme['font'] = {
    sans: parsed.fontSans ?? DEFAULT_FONTS.sans,
    mono: parsed.fontMono ?? DEFAULT_FONTS.mono,
  };
  const spaceMap = { ...DEFAULT_SPACE, ...parsed.space };
  const radiusMap = { ...DEFAULT_RADII, ...parsed.radius };
  return {
    colors,
    font,
    space: (step) => spaceMap[step],
    radius: (size) => radiusMap[size],
  };
}

/**
 * Return the current project's theme. Safe to call from any server component.
 * Client components should receive the theme via props or a context seeded
 * on the server -- do NOT import this from a 'use client' module (it reads
 * the filesystem).
 */
export function getDevKitTheme(cwd: string = process.cwd()): DevKitTheme {
  const path = join(cwd, '.ai-dev-kit', 'registries', 'design-tokens.yaml');
  const cached = themeCache.get(path);
  if (cached) return cached;

  let theme: DevKitTheme;
  if (!existsSync(path)) {
    theme = buildTheme({ colors: {}, space: {}, radius: {} });
  } else {
    const src = readFileSync(path, 'utf-8');
    theme = buildTheme(parseTokens(src));
  }
  themeCache.set(path, theme);
  return theme;
}

/** Test-only helper. Resets the module cache so a test can swap tokens files. */
export function __resetDevKitThemeCache(): void {
  themeCache.clear();
}
