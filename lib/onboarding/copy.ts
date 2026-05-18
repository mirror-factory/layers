/**
 * Onboarding copy — single source of truth.
 *
 * Keep all user-facing strings here so we can tune voice without hunting
 * through three component files. Tone: Paper Calm — calm and decisive,
 * not eager. Match the cadence of app/(public)/pricing/page.tsx.
 *
 * If a step ever changes copy via A/B test or localization, this is the
 * only file that should fork. See PROD-389.
 */

export const onboardingCopy = {
  welcome: {
    eyebrow: "First run",
    title: "Welcome to Layers.",
    body:
      "Record a meeting. We'll pull the decisions, action items, and a clean transcript. Then plug it into ChatGPT, Claude, or Gemini through MCP.",
    primary: "Record now",
    secondary: "Skip tour",
    tertiary: "I'll explore on my own",
  },
  tour: {
    record: {
      title: "Start a recording",
      body: "Tap to start. Mic permission first, then we listen.",
      next: "Next",
    },
    calendar: {
      title: "Calendar context",
      body:
        "Calendar sync is rolling out. When connected, Layers preps the meeting before you start recording.",
      next: "Next",
    },
    mcp: {
      title: "Bring Layers into your AI tool",
      body:
        "Layers ships with an MCP server. Plug it into ChatGPT or Claude and ask questions across every meeting.",
      next: "Got it",
    },
    skip: "Skip tour",
  },
  firstMeeting: {
    title: "Your first meeting is in.",
    body: "Layers extracted the decisions and action items. Take a look.",
    cta: "Open summary",
    dismissAria: "Dismiss first-meeting notice",
  },
} as const;

export type TourStepId = "record" | "calendar" | "mcp";

export const TOUR_STEP_ORDER: TourStepId[] = ["record", "calendar", "mcp"];

export const ONBOARDING_ANCHOR_ATTR = "data-onboarding-anchor";

export const ONBOARDING_ANCHORS = {
  record: "record-button",
  calendar: "calendar-panel",
  mcp: "mcp-card",
} as const;
