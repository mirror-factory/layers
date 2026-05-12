import { describe, expect, it } from "vitest";

import {
  LIBRARY_EMPTY_STATE_SAMPLE,
  LIBRARY_PROMPTS,
  MEETING_PROMPTS,
  PARTICIPANT_FALLBACK,
  PARTICIPANT_TOKEN,
  getPromptsForSurface,
  interpolateParticipant,
} from "@/lib/chat/contextual-prompts";

describe("contextual-prompts: surface selection", () => {
  it("returns the meeting prompt array for the meeting surface", () => {
    expect(getPromptsForSurface("meeting")).toBe(MEETING_PROMPTS);
    expect(getPromptsForSurface("meeting")).toEqual([
      "What did we decide?",
      "Owner and deadlines",
      `Draft a follow-up to ${PARTICIPANT_TOKEN}`,
      "Risks I should flag",
    ]);
  });

  it("returns the library prompt array for the library surface", () => {
    expect(getPromptsForSurface("library")).toBe(LIBRARY_PROMPTS);
    expect(getPromptsForSurface("library")).toEqual([
      "What did I commit to this week?",
      "Recurring blockers",
      "Customers asking about pricing",
      "Decisions across last 5 meetings",
    ]);
  });

  it("keeps meeting and library prompts disjoint so the surfaces never collide", () => {
    const overlap = MEETING_PROMPTS.filter((prompt) =>
      (LIBRARY_PROMPTS as readonly string[]).includes(prompt),
    );
    expect(overlap).toEqual([]);
  });

  it("does not re-export the legacy 5 generic templates as chips", () => {
    const generic = ["Sales", "Interview", "Standup", "Follow-up", "Intake"];
    for (const label of generic) {
      expect(MEETING_PROMPTS).not.toContain(label);
      expect(LIBRARY_PROMPTS).not.toContain(label);
    }
  });

  it("ships a literal sample question for the library empty state", () => {
    expect(LIBRARY_EMPTY_STATE_SAMPLE).toBe(
      "What were the decisions in my last 3 meetings?",
    );
  });
});

describe("contextual-prompts: interpolateParticipant", () => {
  const followUpTemplate = `Draft a follow-up to ${PARTICIPANT_TOKEN}`;

  it("replaces the participant token with the provided name", () => {
    expect(interpolateParticipant(followUpTemplate, "Maya")).toBe(
      "Draft a follow-up to Maya",
    );
  });

  it("trims surrounding whitespace from the participant name", () => {
    expect(interpolateParticipant(followUpTemplate, "  Jordan  ")).toBe(
      "Draft a follow-up to Jordan",
    );
  });

  it("falls back when the participant name is missing, empty, or whitespace", () => {
    const expected = `Draft a follow-up to ${PARTICIPANT_FALLBACK}`;
    expect(interpolateParticipant(followUpTemplate)).toBe(expected);
    expect(interpolateParticipant(followUpTemplate, "")).toBe(expected);
    expect(interpolateParticipant(followUpTemplate, "   ")).toBe(expected);
    expect(interpolateParticipant(followUpTemplate, null)).toBe(expected);
    expect(interpolateParticipant(followUpTemplate, undefined)).toBe(expected);
  });

  it("returns prompts without the token unchanged", () => {
    expect(interpolateParticipant("What did we decide?", "Maya")).toBe(
      "What did we decide?",
    );
  });

  it("replaces every occurrence of the participant token", () => {
    const prompt = `Hey ${PARTICIPANT_TOKEN}, summarize for ${PARTICIPANT_TOKEN}.`;
    expect(interpolateParticipant(prompt, "Sam")).toBe(
      "Hey Sam, summarize for Sam.",
    );
  });
});
