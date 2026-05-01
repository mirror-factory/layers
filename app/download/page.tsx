"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Apple,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Globe,
  MonitorDown,
  Smartphone,
  Store,
} from "lucide-react";
import { ProductLogo } from "@/components/product-logos";
import { PublicSiteNav } from "@/components/public-site-nav";

type DownloadPlatformKey = "web" | "macos" | "windows" | "ios" | "android";

type DownloadChannel = {
  key: DownloadPlatformKey;
  name: string;
  label: string;
  description: string;
  href?: string;
  cta: string;
  unavailableCta: string;
  icon: LucideIcon;
  status: string;
  details: string[];
};

type NavigatorWithUAData = Navigator & {
  userAgentData?: {
    platform?: string;
  };
};

const PUBLIC_DOWNLOAD_URLS = {
  testFlight: cleanUrl(
    process.env.NEXT_PUBLIC_TESTFLIGHT_URL ??
      process.env.NEXT_PUBLIC_IOS_TESTFLIGHT_URL,
  ),
  playInternalTesting: cleanUrl(
    process.env.NEXT_PUBLIC_PLAY_INTERNAL_TESTING_URL ??
      process.env.NEXT_PUBLIC_ANDROID_INTERNAL_TESTING_URL,
  ),
  macArtifact: cleanUrl(
    process.env.NEXT_PUBLIC_MAC_ARTIFACT_URL ??
      process.env.NEXT_PUBLIC_MACOS_DOWNLOAD_URL,
  ),
  windowsArtifact: cleanUrl(
    process.env.NEXT_PUBLIC_WINDOWS_ARTIFACT_URL ??
      process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL,
  ),
  webApp: cleanUrl(process.env.NEXT_PUBLIC_WEB_APP_URL) ?? "/sign-in",
} as const;

const PLATFORM_ORDER: DownloadPlatformKey[] = ["web", "macos", "windows", "ios", "android"];

const DOWNLOAD_CHANNELS: Record<DownloadPlatformKey, DownloadChannel> = {
  web: {
    key: "web",
    name: "Web app",
    label: "Live now",
    description:
      "Use Layers in the browser today for recording, transcript review, search, and AI-ready meeting memory.",
    href: PUBLIC_DOWNLOAD_URLS.webApp,
    cta: "Open web app",
    unavailableCta: "Web app unavailable",
    icon: Globe,
    status: "Recommended first",
    details: ["No install required", "Works on modern desktop browsers", "Same account as native apps"],
  },
  macos: {
    key: "macos",
    name: "macOS",
    label: "Desktop beta",
    description:
      "The Mac beta is the native capture path for local meeting workflows once the signed artifact is ready.",
    href: PUBLIC_DOWNLOAD_URLS.macArtifact,
    cta: "Download Mac beta",
    unavailableCta: "Mac beta in prep",
    icon: Apple,
    status: PUBLIC_DOWNLOAD_URLS.macArtifact ? "Artifact ready" : "Packaging",
    details: ["Native capture workflow", "macOS 13 or later", "Microphone permission required"],
  },
  windows: {
    key: "windows",
    name: "Windows",
    label: "Desktop beta",
    description:
      "The Windows beta will support the same private capture and meeting memory workflow for launch cohorts.",
    href: PUBLIC_DOWNLOAD_URLS.windowsArtifact,
    cta: "Download Windows beta",
    unavailableCta: "Windows beta in prep",
    icon: MonitorDown,
    status: PUBLIC_DOWNLOAD_URLS.windowsArtifact ? "Artifact ready" : "Packaging",
    details: ["Windows 10 or 11", "Desktop capture workflow", "Same Layers workspace"],
  },
  ios: {
    key: "ios",
    name: "iPhone and iPad",
    label: "TestFlight",
    description:
      "TestFlight will be used for mobile review, reminders, and capture experiments once invites are live.",
    href: PUBLIC_DOWNLOAD_URLS.testFlight,
    cta: "Open TestFlight",
    unavailableCta: "TestFlight in prep",
    icon: Smartphone,
    status: PUBLIC_DOWNLOAD_URLS.testFlight ? "Invite ready" : "Invite prep",
    details: ["Requires TestFlight", "Mobile review flow", "Same meeting library"],
  },
  android: {
    key: "android",
    name: "Android",
    label: "Play internal testing",
    description:
      "The Android internal testing track will open once the tester list and opt-in link are ready.",
    href: PUBLIC_DOWNLOAD_URLS.playInternalTesting,
    cta: "Open Play testing",
    unavailableCta: "Play testing in prep",
    icon: Store,
    status: PUBLIC_DOWNLOAD_URLS.playInternalTesting ? "Testing link ready" : "Track prep",
    details: ["Google account required", "Internal testing track", "Mobile capture experiments"],
  },
};

function cleanUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function isChannelAvailable(channel: DownloadChannel): channel is DownloadChannel & {
  href: string;
} {
  return Boolean(channel.href);
}

function detectPlatform(): DownloadPlatformKey {
  const nav = navigator as NavigatorWithUAData;
  const platform = (
    nav.userAgentData?.platform ??
    navigator.platform ??
    ""
  ).toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;

  if (/android/.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/.test(userAgent)) return "ios";
  if (platform.includes("mac") && maxTouchPoints > 1) return "ios";
  if (platform.includes("mac") || /mac os x/.test(userAgent)) return "macos";
  if (platform.includes("win") || /windows/.test(userAgent)) return "windows";

  return "web";
}

function getPlatformSnapshot(): DownloadPlatformKey {
  if (typeof navigator === "undefined") return "web";
  return detectPlatform();
}

function getServerPlatformSnapshot(): DownloadPlatformKey {
  return "web";
}

function subscribeToPlatformChanges(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("orientationchange", onStoreChange);
  window.addEventListener("resize", onStoreChange);

  return () => {
    window.removeEventListener("orientationchange", onStoreChange);
    window.removeEventListener("resize", onStoreChange);
  };
}

function ChannelAction({ channel }: { channel: DownloadChannel }) {
  if (!isChannelAvailable(channel)) {
    return (
      <span className="download-card-action is-disabled" aria-disabled="true">
        <CircleDashed size={15} aria-hidden="true" />
        {channel.unavailableCta}
      </span>
    );
  }

  const content = (
    <>
      {channel.cta}
      {isExternalHref(channel.href) ? (
        <ExternalLink size={15} aria-hidden="true" />
      ) : (
        <ArrowRight size={15} aria-hidden="true" />
      )}
    </>
  );

  if (isExternalHref(channel.href)) {
    return (
      <a className="download-card-action" href={channel.href} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return (
    <Link className="download-card-action" href={channel.href}>
      {content}
    </Link>
  );
}

function PlatformRecommendation() {
  const detectedPlatform = useSyncExternalStore(
    subscribeToPlatformChanges,
    getPlatformSnapshot,
    getServerPlatformSnapshot,
  );
  const channel = DOWNLOAD_CHANNELS[detectedPlatform];
  const website = DOWNLOAD_CHANNELS.web;
  const Icon = channel.icon;

  return (
    <section className="download-recommendation-v2" aria-live="polite">
      <span className="download-recommendation-icon">
        <Icon size={22} aria-hidden="true" />
      </span>
      <div>
        <p>Recommended for this device</p>
        <h2>{isChannelAvailable(channel) ? channel.cta : website.cta}</h2>
        <span>
          {isChannelAvailable(channel)
            ? channel.description
            : `${channel.name} is still in prep, so use the web app today.`}
        </span>
      </div>
      <ChannelAction channel={isChannelAvailable(channel) ? channel : website} />
    </section>
  );
}

function DownloadAppPreview() {
  return (
    <div className="download-app-preview" aria-label="Layers app preview">
      <div className="download-preview-top">
        <span>Layers</span>
        <small>Meeting ready</small>
      </div>
      <div className="download-preview-grid">
        <div className="download-preview-recording">
          <strong>Product planning</strong>
          <span>00:13 live capture</span>
          <div aria-hidden="true">
            {Array.from({ length: 22 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
        </div>
        <div className="download-preview-memory">
          <p>
            <CheckCircle2 size={13} aria-hidden="true" />
            2 decisions
          </p>
          <p>
            <CheckCircle2 size={13} aria-hidden="true" />
            4 actions
          </p>
          <p>
            <CheckCircle2 size={13} aria-hidden="true" />
            Searchable
          </p>
        </div>
      </div>
      <div className="download-preview-tools">
        <ProductLogo id="chatgpt" />
        <ProductLogo id="claude" />
        <ProductLogo id="gemini" />
      </div>
    </div>
  );
}

function DownloadCard({ channel }: { channel: DownloadChannel }) {
  const Icon = channel.icon;

  return (
    <article className={`download-card-v2 is-${channel.key}`}>
      <div className="download-card-head">
        <span>
          <Icon size={18} aria-hidden="true" />
        </span>
        <small>{channel.label}</small>
      </div>
      <h3>{channel.name}</h3>
      <p>{channel.description}</p>
      <ul>
        {channel.details.map((detail) => (
          <li key={detail}>
            <CheckCircle2 size={14} aria-hidden="true" />
            {detail}
          </li>
        ))}
      </ul>
      <div className="download-card-footer">
        <span>{channel.status}</span>
        <ChannelAction channel={channel} />
      </div>
    </article>
  );
}

export default function DownloadPage() {
  return (
    <main className="download-page download-page-v2 min-h-screen-safe">
      <PublicSiteNav active="download" />

      <section className="download-hero download-hero-v2">
        <div>
          <span className="download-kicker">Download Layers</span>
          <h1>Use the web app now. Add native capture as beta builds go live.</h1>
          <p>
            Layers is launch-ready in the browser. Desktop and mobile builds stay
            visible as honest beta channels, without dead download buttons.
          </p>
          <div className="download-hero-actions">
            <ChannelAction channel={DOWNLOAD_CHANNELS.web} />
            <Link href="/sign-up" className="download-secondary">
              Create account
            </Link>
          </div>
        </div>
        <DownloadAppPreview />
      </section>

      <PlatformRecommendation />

      <section className="download-channel-grid" aria-label="Download channels">
        {PLATFORM_ORDER.map((key) => (
          <DownloadCard key={key} channel={DOWNLOAD_CHANNELS[key]} />
        ))}
      </section>
    </main>
  );
}
