import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LayersLogo } from "@/components/layers-logo";
import { cn } from "@/lib/utils";

interface PublicSiteNavProps {
  active?: "download" | "pricing";
  compact?: boolean;
  showBack?: boolean;
}

export function PublicSiteNav({
  active,
  compact = false,
  showBack = false,
}: PublicSiteNavProps) {
  return (
    <nav className={cn("site-nav", compact && "is-compact")} aria-label="Primary navigation">
      <div className="site-nav-leading">
        {showBack ? (
          <Link href="/" className="site-nav-back">
            <ArrowLeft size={16} aria-hidden="true" />
            Back
          </Link>
        ) : null}
        <Link href="/" className="site-brand" aria-label="Layers home">
          <LayersLogo />
        </Link>
      </div>

      {!compact ? (
        <div className="site-nav-links">
          <Link className={cn(active === "download" && "is-active")} href="/download">
            Download
          </Link>
          <Link className={cn(active === "pricing" && "is-active")} href="/pricing">
            Pricing
          </Link>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up" className="site-nav-cta">
            Start free
          </Link>
        </div>
      ) : null}
    </nav>
  );
}
