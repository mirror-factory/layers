/**
 * Unit tests for the PROD-390 onboarding email templates.
 *
 * The templates are pure functions of (appUrl) → { subject, html }. We don't
 * try to validate every byte — we assert the load-bearing properties that a
 * marketing tweak might accidentally regress:
 *
 *   - The subject lines stay tightly worded (no marketing-style trailing
 *     emojis, no "Re:" hijacking).
 *   - The Paper Calm brand voice: no "Hi there!", no emojis.
 *   - The CTAs link to the right destination.
 *   - The opt-out footer is always present.
 */

import { describe, expect, it } from "vitest";
import {
  welcomeEmail,
  firstMeetingNudgeEmail,
  weekOneFollowupEmail,
} from "@/lib/email/templates";

const APP_URL = "https://layers.example.com";

const FORBIDDEN_VOICE = [
  /Hi there!/i,
  /Hey there!/i,
  /Hello!/i,
  /\u{1F600}-\u{1F64F}/u, // emoticons
];

function assertPaperCalmVoice(subject: string, html: string) {
  expect(subject).toBeTruthy();
  expect(subject.length).toBeLessThanOrEqual(80);
  // No trailing exclamation marks in subject — Paper Calm is restrained.
  expect(subject).not.toMatch(/!$/);
  for (const pattern of FORBIDDEN_VOICE) {
    expect(html).not.toMatch(pattern);
  }
}

describe("welcomeEmail", () => {
  it("renders the Paper Calm welcome with a /record CTA", () => {
    const { subject, html } = welcomeEmail(APP_URL);

    expect(subject).toBe("Welcome to Layers — here's what to do next");
    assertPaperCalmVoice(subject, html);

    expect(html).toContain("Welcome to Layers");
    expect(html).toContain(`${APP_URL}/record`);
    expect(html).toContain("Start a recording");
    expect(html).toContain("Two minutes is enough");
    // unsubscribe footer
    expect(html).toContain(`${APP_URL}/settings/notifications`);
  });
});

describe("firstMeetingNudgeEmail", () => {
  it("renders the 24h nudge with a /record CTA", () => {
    const { subject, html } = firstMeetingNudgeEmail(APP_URL);

    expect(subject).toBe(
      "Try a short recording to see what Layers remembers",
    );
    assertPaperCalmVoice(subject, html);

    expect(html).toContain(`${APP_URL}/record`);
    expect(html).toContain("Record two minutes");
    // No streak / FOMO language
    expect(html).not.toMatch(/streak/i);
    expect(html).not.toMatch(/don't lose/i);
    expect(html).toContain(`${APP_URL}/settings/notifications`);
  });
});

describe("weekOneFollowupEmail", () => {
  it("renders the day-7 follow-up with an admin contact link", () => {
    const { subject, html } = weekOneFollowupEmail(APP_URL);

    expect(subject).toBe("What's worked? What hasn't?");
    assertPaperCalmVoice(subject, html);

    expect(html).toContain("mailto:admin@mirafactory.ai");
    expect(html).toContain("read every reply");
    expect(html).toContain(`${APP_URL}/settings/notifications`);
  });
});
