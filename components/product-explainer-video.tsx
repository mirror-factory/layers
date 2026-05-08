import { Bricolage_Grotesque } from "next/font/google";
import { LayersLogoMark } from "@/components/layers-logo";

type ProductExplainerEmbed = {
  embedUrl: string;
};

function cleanUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getYouTubeId(url: URL): string | undefined {
  if (url.hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0];
  }

  if (!/(^|\.)youtube\.com$/.test(url.hostname)) {
    return undefined;
  }

  if (url.pathname === "/watch") {
    return cleanUrl(url.searchParams.get("v") ?? undefined);
  }

  const [kind, id] = url.pathname.split("/").filter(Boolean);
  if (kind === "embed" || kind === "shorts" || kind === "live") {
    return id;
  }

  return undefined;
}

function getVimeoEmbedPath(url: URL): string | undefined {
  if (url.hostname === "player.vimeo.com") {
    const [kind, id] = url.pathname.split("/").filter(Boolean);
    const hash = cleanUrl(url.searchParams.get("h") ?? undefined);
    if (kind !== "video" || !id) return undefined;
    return hash
      ? `${encodeURIComponent(id)}?h=${encodeURIComponent(hash)}`
      : encodeURIComponent(id);
  }

  if (!/(^|\.)vimeo\.com$/.test(url.hostname)) {
    return undefined;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const idIndex = parts.findIndex((part) => /^\d+$/.test(part));
  if (idIndex === -1) return undefined;

  const id = parts[idIndex];
  const hash = cleanUrl(parts[idIndex + 1]);
  return hash
    ? `${encodeURIComponent(id)}?h=${encodeURIComponent(hash)}`
    : encodeURIComponent(id);
}

function getProductExplainerEmbed(
  rawUrl: string | undefined,
): ProductExplainerEmbed | undefined {
  const value = cleanUrl(rawUrl);
  if (!value) return undefined;

  try {
    const url = new URL(value);
    const youtubeId = getYouTubeId(url);
    if (youtubeId) {
      return {
        embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
          youtubeId,
        )}?rel=0&modestbranding=1`,
      };
    }

    const vimeoPath = getVimeoEmbedPath(url);
    if (vimeoPath) {
      return {
        embedUrl: `https://player.vimeo.com/video/${vimeoPath}${
          vimeoPath.includes("?") ? "&" : "?"
        }badge=0&autopause=0&player_id=layers-product-explainer`,
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

const PRODUCT_EXPLAINER = getProductExplainerEmbed(
  process.env.NEXT_PUBLIC_PRODUCT_EXPLAINER_VIDEO_URL,
);

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display-marketing",
  display: "swap",
});

export function ProductExplainerVideo({
  eyebrow = "Product tour",
  title = "See how Layers turns a meeting into AI memory.",
  description = "A short founder-led walkthrough: record, transcript, meeting memory, cross-meeting search, and MCP results in ChatGPT or Claude.",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  return (
    <section
      id="product-explainer"
      aria-labelledby="product-explainer-heading"
      className={display.variable}
      style={{
        background: "var(--bg-page)",
        color: "var(--fg-default)",
        fontFamily: "var(--font-sans, var(--font-brand-sans))",
        maxWidth: 1240,
        marginInline: "auto",
        paddingInline: "clamp(20px, 5vw, 56px)",
        paddingBlock: "clamp(44px, 6vw, 88px)",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 24,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 10,
            maxWidth: 720,
          }}
        >
          <span
            className="home-eyebrow"
            style={{
              color: "var(--fg-muted)",
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </span>
          <h2
            id="product-explainer-heading"
            style={{
              color: "var(--fg-default)",
              fontFamily: "var(--font-display-marketing), var(--font-brand-sans)",
              fontSize: "clamp(1.8rem, 1.25rem + 2vw, 3rem)",
              fontWeight: 600,
              letterSpacing: 0,
              lineHeight: 1.08,
              margin: 0,
            }}
          >
            {title}
          </h2>
          <p
            style={{
              color: "var(--fg-muted)",
              fontSize: "clamp(1rem, 0.96rem + 0.2vw, 1.12rem)",
              lineHeight: 1.55,
              margin: 0,
              maxWidth: "60ch",
            }}
          >
            {description}
          </p>
        </div>

        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "var(--radius-card)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            boxShadow:
              "0 1px 0 oklch(1 0 0 / .72) inset, 0 28px 56px -36px color-mix(in oklch, var(--layers-ink) 28%, transparent)",
          }}
        >
          <div
            style={{
              aspectRatio: "16 / 9",
              display: "grid",
              placeItems: "center",
              background:
                "linear-gradient(135deg, var(--layers-mint-tint), var(--bg-surface) 44%, var(--layers-blue-tint))",
            }}
          >
            {PRODUCT_EXPLAINER ? (
              <iframe
                title="Layers product explainer video"
                src={PRODUCT_EXPLAINER.embedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                style={{
                  width: "100%",
                  height: "100%",
                  border: 0,
                  display: "block",
                  background: "var(--layers-ink)",
                }}
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 18,
                  justifyItems: "center",
                  padding: "clamp(24px, 6vw, 56px)",
                  textAlign: "center",
                }}
              >
                <LayersLogoMark size={48} animated />
                <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
                  <p
                    style={{
                      color: "var(--fg-default)",
                      fontFamily:
                        "var(--font-display-marketing), var(--font-brand-sans)",
                      fontSize: "clamp(1.35rem, 1rem + 1.4vw, 2rem)",
                      fontWeight: 600,
                      letterSpacing: 0,
                      lineHeight: 1.12,
                      margin: 0,
                    }}
                  >
                    AI memory for your meetings.
                  </p>
                  <p
                    style={{
                      color: "var(--fg-muted)",
                      fontSize: "0.98rem",
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    Founder-led product walkthrough: recording UI, transcript,
                    meeting memory, cross-meeting search, and MCP results.
                  </p>
                </div>
              </div>
            )}
          </div>

          <p
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "4px 8px",
              padding: "14px 18px",
              borderTop: "1px solid var(--border-subtle)",
              color: "var(--fg-muted)",
              fontSize: "0.82rem",
              lineHeight: 1.45,
              margin: 0,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <LayersLogoMark size={20} />
              <span>Currently in invite-only alpha. Email</span>
            </span>
            <a
              href="mailto:support@mirrorfactory.ai?subject=Layers%20alpha%20access"
              style={{
                color: "var(--layers-blue)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              support@mirrorfactory.ai
            </a>
            <span>for access.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
