import { describe, it, expect } from "vitest";
import {
  INITIAL_STATE,
  ONBOARDING_STORAGE_VERSION,
  isWalkthroughComplete,
  nextTourStep,
  parseOnboardingState,
  reduce,
  serializeOnboardingState,
  type OnboardingState,
} from "../lib/onboarding/state";

const FROZEN_NOW = "2026-05-11T12:00:00.000Z";

function freshState(): OnboardingState {
  return { ...INITIAL_STATE, tourStepsCompleted: [] };
}

describe("onboarding state machine (PROD-389)", () => {
  describe("parseOnboardingState", () => {
    it("returns the initial state for a null payload", () => {
      expect(parseOnboardingState(null)).toEqual(INITIAL_STATE);
    });

    it("returns the initial state for malformed JSON", () => {
      expect(parseOnboardingState("not-json")).toEqual(INITIAL_STATE);
    });

    it("returns the initial state for an old version", () => {
      const raw = JSON.stringify({
        ...INITIAL_STATE,
        version: ONBOARDING_STORAGE_VERSION - 1,
        welcomeSeen: true,
      });
      expect(parseOnboardingState(raw)).toEqual(INITIAL_STATE);
    });

    it("filters out unknown tour step ids", () => {
      const raw = JSON.stringify({
        ...INITIAL_STATE,
        welcomeSeen: true,
        tourStepsCompleted: ["record", "bogus", "mcp"],
      });
      const parsed = parseOnboardingState(raw);
      expect(parsed.tourStepsCompleted).toEqual(["record", "mcp"]);
      expect(parsed.welcomeSeen).toBe(true);
    });

    it("round-trips through serialize/parse", () => {
      const state: OnboardingState = {
        ...INITIAL_STATE,
        welcomeSeen: true,
        tourStepsCompleted: ["record", "calendar"],
        firstMeetingSeen: true,
        completedAt: FROZEN_NOW,
      };
      expect(parseOnboardingState(serializeOnboardingState(state))).toEqual(state);
    });
  });

  describe("nextTourStep", () => {
    it("starts at the first step on a fresh state", () => {
      expect(nextTourStep(freshState())).toBe("record");
    });

    it("walks forward as steps complete", () => {
      const after1 = reduce(freshState(), { type: "tour.advanced", step: "record" });
      expect(nextTourStep(after1)).toBe("calendar");

      const after2 = reduce(after1, { type: "tour.advanced", step: "calendar" });
      expect(nextTourStep(after2)).toBe("mcp");

      const after3 = reduce(after2, { type: "tour.advanced", step: "mcp" });
      expect(nextTourStep(after3)).toBeNull();
    });

    it("returns null once the user skips all steps", () => {
      const after = reduce(freshState(), { type: "tour.skipped" });
      expect(nextTourStep(after)).toBeNull();
    });
  });

  describe("welcome.dismissed", () => {
    it("marks welcomeSeen without skipping when outcome is 'primary'", () => {
      const next = reduce(freshState(), {
        type: "welcome.dismissed",
        outcome: "primary",
      });
      expect(next.welcomeSeen).toBe(true);
      expect(next.skippedAll).toBe(false);
      expect(next.completedAt).toBeNull();
    });

    it("marks welcomeSeen without skipping when outcome is 'explore'", () => {
      const next = reduce(freshState(), {
        type: "welcome.dismissed",
        outcome: "explore",
      });
      expect(next.welcomeSeen).toBe(true);
      expect(next.skippedAll).toBe(false);
    });

    it("sets skippedAll and completedAt when outcome is 'skip'", () => {
      const next = reduce(
        freshState(),
        { type: "welcome.dismissed", outcome: "skip" },
        () => FROZEN_NOW,
      );
      expect(next.welcomeSeen).toBe(true);
      expect(next.skippedAll).toBe(true);
      expect(next.completedAt).toBe(FROZEN_NOW);
    });
  });

  describe("tour.advanced", () => {
    it("is idempotent — advancing the same step twice does not duplicate entries", () => {
      const once = reduce(freshState(), { type: "tour.advanced", step: "record" });
      const twice = reduce(once, { type: "tour.advanced", step: "record" });
      expect(twice.tourStepsCompleted).toEqual(["record"]);
      expect(twice).toBe(once);
    });

    it("records completedAt once the final step is reached", () => {
      let state = freshState();
      state = reduce(state, { type: "tour.advanced", step: "record" }, () => FROZEN_NOW);
      state = reduce(state, { type: "tour.advanced", step: "calendar" }, () => FROZEN_NOW);
      expect(state.completedAt).toBeNull();
      state = reduce(state, { type: "tour.advanced", step: "mcp" }, () => FROZEN_NOW);
      expect(state.completedAt).toBe(FROZEN_NOW);
    });
  });

  describe("tour.skipped", () => {
    it("disables all remaining onboarding surfaces", () => {
      const after = reduce(freshState(), { type: "tour.skipped" }, () => FROZEN_NOW);
      expect(after.skippedAll).toBe(true);
      expect(after.completedAt).toBe(FROZEN_NOW);
      expect(nextTourStep(after)).toBeNull();
      expect(isWalkthroughComplete(after)).toBe(true);
    });

    it("preserves an earlier completedAt timestamp", () => {
      const earlier = "2026-05-01T00:00:00.000Z";
      const state: OnboardingState = {
        ...freshState(),
        welcomeSeen: true,
        completedAt: earlier,
      };
      const after = reduce(state, { type: "tour.skipped" }, () => FROZEN_NOW);
      expect(after.completedAt).toBe(earlier);
    });
  });

  describe("first-meeting.seen", () => {
    it("flips firstMeetingSeen to true", () => {
      const next = reduce(freshState(), { type: "first-meeting.seen" });
      expect(next.firstMeetingSeen).toBe(true);
    });

    it("only fires once in user terms — already-seen state is a no-op shape", () => {
      const once = reduce(freshState(), { type: "first-meeting.seen" });
      const twice = reduce(once, { type: "first-meeting.seen" });
      expect(twice.firstMeetingSeen).toBe(true);
    });
  });

  describe("isWalkthroughComplete", () => {
    it("returns false on a fresh state", () => {
      expect(isWalkthroughComplete(freshState())).toBe(false);
    });

    it("returns true after every step has been advanced", () => {
      let state = freshState();
      state = reduce(state, { type: "tour.advanced", step: "record" });
      state = reduce(state, { type: "tour.advanced", step: "calendar" });
      state = reduce(state, { type: "tour.advanced", step: "mcp" });
      expect(isWalkthroughComplete(state)).toBe(true);
    });

    it("returns true once skippedAll is set, regardless of step progress", () => {
      const state = reduce(freshState(), { type: "tour.skipped" });
      expect(isWalkthroughComplete(state)).toBe(true);
    });
  });
});
