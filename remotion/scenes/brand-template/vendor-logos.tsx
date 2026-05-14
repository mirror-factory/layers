import React from "react";
import { Img, staticFile } from "remotion";

/**
 * Vendor logos — real canonical SVGs cached locally to `public/brand-icons/`.
 *
 * Sources:
 *   Claude / OpenAI / Gemini / Cursor / Anthropic / MCP — `@lobehub/icons-static-svg`
 *     (https://github.com/lobehub/lobe-icons, MIT, no API key)
 *   Linear / Notion — SimpleIcons (https://simpleicons.org, CC0)
 *
 * To refresh from the canonical sources:
 *
 *   ```bash
 *   cd public/brand-icons
 *   for slug in claude-color openai gemini-color cursor anthropic mcp; do
 *     curl -sL -o "$slug.svg" "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/$slug.svg"
 *   done
 *   curl -sL -o linear.svg "https://cdn.simpleicons.org/linear/5e6ad2"
 *   curl -sL -o notion.svg "https://cdn.simpleicons.org/notion/0b0c0e"
 *   ```
 *
 * The combined Claude skill `.claude/skills/layers-brand-remotion/SKILL.md`
 * documents the policy: never approximate, always reach for the cached SVG,
 * a skill, or the context.dev MCP.
 */

type Props = { size?: number };

const Logo: React.FC<Props & { src: string; label: string }> = ({
  size = 56,
  src,
  label,
}) => (
  <Img
    src={staticFile(src)}
    alt={label}
    style={{ width: size, height: size, display: "block", objectFit: "contain" }}
  />
);

export const ClaudeLogo: React.FC<Props> = ({ size = 56 }) => (
  <Logo size={size} src="brand-icons/claude-color.svg" label="Claude" />
);

export const ChatGptLogo: React.FC<Props> = ({ size = 56 }) => (
  <Logo size={size} src="brand-icons/openai.svg" label="OpenAI" />
);

export const GeminiLogo: React.FC<Props> = ({ size = 56 }) => (
  <Logo size={size} src="brand-icons/gemini-color.svg" label="Gemini" />
);

export const CursorLogo: React.FC<Props> = ({ size = 56 }) => (
  <Logo size={size} src="brand-icons/cursor.svg" label="Cursor" />
);

export const McpLogo: React.FC<Props> = ({ size = 56 }) => (
  <Logo size={size} src="brand-icons/mcp.svg" label="MCP" />
);

export const LinearLogo: React.FC<Props> = ({ size = 56 }) => (
  <Logo size={size} src="brand-icons/linear.svg" label="Linear" />
);

export const NotionLogo: React.FC<Props> = ({ size = 56 }) => (
  <Logo size={size} src="brand-icons/notion.svg" label="Notion" />
);
