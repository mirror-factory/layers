import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface LayersLogoMarkProps {
  className?: string;
  size?: number;
  animated?: boolean;
}

export function LayersLogoMark({
  className,
  size = 32,
  animated = false,
}: LayersLogoMarkProps) {
  return (
    <span
      className={cn("ly-logo-mark", animated && "is-animated", className)}
      style={{ "--ly-logo-size": `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" focusable="false">
        <path
          className="ly-mark-ring ly-mark-ring-outer"
          d="M16 4 a12 12 0 1 1 0 24"
          fill="none"
          stroke="var(--layers-blue)"
          strokeLinecap="round"
          strokeWidth="2.6"
          pathLength="100"
        />
        <path
          className="ly-mark-ring ly-mark-ring-mid"
          d="M16 8.5 a7.5 7.5 0 1 1 0 15"
          fill="none"
          stroke="var(--layers-violet)"
          strokeLinecap="round"
          strokeWidth="2.6"
          pathLength="100"
        />
        <circle
          className="ly-mark-halo"
          cx="16"
          cy="16"
          r="4"
          fill="var(--layers-mint)"
          opacity="0.22"
        />
        <circle
          className="ly-mark-dot"
          cx="16"
          cy="16"
          r="2"
          fill="var(--layers-mint)"
        />
      </svg>
    </span>
  );
}

export function LayersLogo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("ly-logo", className)}>
      <LayersLogoMark className={markClassName} size={32} />
      <span className="ly-logo-text">Layers</span>
    </span>
  );
}
