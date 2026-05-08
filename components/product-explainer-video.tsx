import { LayersLogoMark } from "@/components/layers-logo";

type ProductExplainerEmbed = {
  provider: "youtube" | "vimeo";
  embedUrl: string;
  watchUrl: string;
};

const VIDEO_TITLE = "Layers product explainer";

export function getProductExplainerEmbed(
  rawUrl: string | undefined,
): ProductExplainerEmbed | null {
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const videoId = url.pathname.split("/").filter(Boolean)[0];
    if (!videoId) return null;
    return {
      provider: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`,
      watchUrl: rawUrl,
    };
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    const videoId =
      url.searchParams.get("v") ??
      url.pathname.match(/^\/(?:embed|shorts)\/([^/?#]+)/)?.[1];
    if (!videoId) return null;
    return {
      provider: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`,
      watchUrl: rawUrl,
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const videoId = url.pathname.match(/(\d+)/)?.[1];
    if (!videoId) return null;
    return {
      provider: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${videoId}`,
      watchUrl: rawUrl,
    };
  }

  return null;
}

export function ProductExplainerVideo({
  eyebrow = "See how it works",
  compact = false,
}: {
  eyebrow?: string;
  compact?: boolean;
}) {
  const embed = getProductExplainerEmbed(
    process.env.NEXT_PUBLIC_PRODUCT_EXPLAINER_VIDEO_URL,
  );

  return (
    <section
      id="product-explainer"
      className={compact ? "explainer-section is-compact" : "explainer-section"}
      aria-labelledby="product-explainer-heading"
    >
      <div className="explainer-copy">
        <span className="explainer-eyebrow">{eyebrow}</span>
        <h2 id="product-explainer-heading">
          AI memory for your meetings.
          <span>Decisions that move work forward.</span>
        </h2>
        <p>
          A 60-90 second walkthrough of the real Layers flow: record a meeting,
          watch the transcript appear, save memory, search across prior
          meetings, and call that memory from an MCP-enabled AI tool.
        </p>
      </div>

      <div className="explainer-frame">
        {embed ? (
          <iframe
            title={VIDEO_TITLE}
            src={embed.embedUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <div className="explainer-fallback" role="status">
            <LayersLogoMark size={44} animated />
            <span>Product explainer pending</span>
            <p>
              Add the unlisted Vimeo or YouTube URL to{" "}
              <code>NEXT_PUBLIC_PRODUCT_EXPLAINER_VIDEO_URL</code> after the
              founder-recorded screen capture is ready.
            </p>
          </div>
        )}
      </div>

      <div className="explainer-foot">
        <p>
          Currently in invite-only alpha. Email{" "}
          <a href="mailto:support@mirrorfactory.ai">
            support@mirrorfactory.ai
          </a>{" "}
          for access.
          {embed ? (
            <>
              {" "}
              <a href={embed.watchUrl} target="_blank" rel="noreferrer">
                Open on {embed.provider === "youtube" ? "YouTube" : "Vimeo"}.
              </a>
            </>
          ) : null}
        </p>
        <LayersLogoMark size={28} animated />
      </div>

      <style jsx>{`
        .explainer-section {
          display: grid;
          gap: clamp(20px, 3vw, 32px);
          max-width: 1240px;
          margin-inline: auto;
          padding: clamp(56px, 7vw, 96px) clamp(20px, 5vw, 56px);
        }

        .explainer-section.is-compact {
          padding-inline: 0;
          padding-block: clamp(48px, 6vw, 80px);
        }

        .explainer-copy {
          display: grid;
          gap: 12px;
          max-width: 760px;
        }

        .explainer-eyebrow {
          color: var(--fg-muted);
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        h2 {
          margin: 0;
          color: var(--fg-default);
          font-size: 2.9rem;
          font-weight: 600;
          letter-spacing: 0;
          line-height: 1.06;
          text-wrap: balance;
        }

        h2 span {
          display: block;
          color: var(--layers-mint);
        }

        .explainer-copy p,
        .explainer-foot p {
          margin: 0;
          color: var(--fg-muted);
          font-size: 1.05rem;
          line-height: 1.55;
          text-wrap: pretty;
        }

        .explainer-copy p {
          max-width: 68ch;
        }

        .explainer-frame {
          position: relative;
          overflow: hidden;
          aspect-ratio: 16 / 9;
          min-height: 220px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-2xl, 20px);
          background:
            linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-page) 100%),
            var(--bg-surface);
          box-shadow:
            0 30px 70px -44px color-mix(in oklch, var(--layers-violet) 24%, transparent),
            0 1px 0 color-mix(in oklch, var(--fg-default) 8%, transparent);
        }

        iframe,
        .explainer-fallback {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }

        .explainer-fallback {
          display: grid;
          place-items: center;
          align-content: center;
          gap: 12px;
          padding: clamp(20px, 4vw, 48px);
          text-align: center;
        }

        .explainer-fallback span {
          color: var(--fg-default);
          font-size: 1.45rem;
          font-weight: 600;
          letter-spacing: 0;
        }

        .explainer-fallback p {
          max-width: 56ch;
          margin: 0;
          color: var(--fg-muted);
          font-size: 0.95rem;
          line-height: 1.5;
        }

        code {
          border-radius: var(--radius-sm, 6px);
          background: var(--bg-page-tint-2, var(--bg-page));
          color: var(--fg-default);
          font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
          font-size: 0.88em;
          padding: 0.1em 0.34em;
        }

        .explainer-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding-top: 2px;
        }

        a {
          color: var(--layers-blue);
          font-weight: 600;
          text-decoration: none;
        }

        a:hover {
          text-decoration: underline;
          text-underline-offset: 4px;
        }

        @media (max-width: 640px) {
          h2 {
            font-size: 2rem;
          }

          .explainer-copy p,
          .explainer-foot p {
            font-size: 1rem;
          }

          .explainer-fallback span {
            font-size: 1.2rem;
          }

          .explainer-foot {
            align-items: flex-start;
          }
        }
      `}</style>
    </section>
  );
}
