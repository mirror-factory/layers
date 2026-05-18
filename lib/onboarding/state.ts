/**
 * Onboarding state machine — pure, framework-agnostic, easy to test.
 *
 * Persistence: localStorage under a versioned key. We chose localStorage over
 * a Supabase `profiles.onboarding_state JSONB` column for the MVP because:
 *   (a) we ship onboarding before the schema migration lands so the alpha
 *       cohort gets the walkthrough immediately
 *   (b) cross-device persistence is a follow-up — alpha users sign in on a
 *       single device today
 *   (c) it removes the API-route + RLS-update-policy work from the critical
 *       path. The migration is tracked separately and the provider has a
 *       clearly-marked `TODO(prod-389-remote-persist)` hook to swap in.
 *
 * The key is versioned (`layers_onboarding_v1`) so a future v2 reset is
 * one constant change away.
 *
 * See PROD-389 for the full state shape.
 */

import { TOUR_STEP_ORDER, type TourStepId } from "./copy";

export const ONBOARDING_STORAGE_KEY = "layers_onboarding_v1";
export const ONBOARDING_STORAGE_VERSION = 1;

export interface OnboardingState {
  version: number;
  welcomeSeen: boolean;
  /** Ordered list of tour steps the user has advanced past. */
  tourStepsCompleted: TourStepId[];
  firstMeetingSeen: boolean;
  /** When set, all remaining onboarding surfaces are suppressed. */
  skippedAll: boolean;
  /** ISO 8601 string set when the full tour has been completed or skipped. */
  completedAt: string | null;
}

export const INITIAL_STATE: OnboardingState = {
  version: ONBOARDING_STORAGE_VERSION,
  welcomeSeen: false,
  tourStepsCompleted: [],
  firstMeetingSeen: false,
  skippedAll: false,
  completedAt: null,
};

function isTourStepId(value: unknown): value is TourStepId {
  return (
    typeof value === "string" &&
    (TOUR_STEP_ORDER as readonly string[]).includes(value)
  );
}

/**
 * Parse a raw JSON string into a valid OnboardingState. Returns INITIAL_STATE
 * for any malformed, missing, or wrong-version payload — never throws.
 */
export function parseOnboardingState(raw: string | null): OnboardingState {
  if (!raw) return { ...INITIAL_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingState> | null;
    if (!parsed || typeof parsed !== "object") return { ...INITIAL_STATE };
    if (parsed.version !== ONBOARDING_STORAGE_VERSION) {
      return { ...INITIAL_STATE };
    }
    const rawSteps = Array.isArray(parsed.tourStepsCompleted)
      ? parsed.tourStepsCompleted
      : [];
    return {
      version: ONBOARDING_STORAGE_VERSION,
      welcomeSeen: Boolean(parsed.welcomeSeen),
      tourStepsCompleted: rawSteps.filter(isTourStepId),
      firstMeetingSeen: Boolean(parsed.firstMeetingSeen),
      skippedAll: Boolean(parsed.skippedAll),
      completedAt:
        typeof parsed.completedAt === "string" ? parsed.completedAt : null,
    };
  } catch {
    return { ...INITIAL_STATE };
  }
}

export function serializeOnboardingState(state: OnboardingState): string {
  return JSON.stringify(state);
}

/**
 * Compute the next tour step that should be shown, or null if the tour is
 * done. `null` is the canonical "nothing to show" signal across the provider
 * and components.
 */
export function nextTourStep(state: OnboardingState): TourStepId | null {
  if (state.skippedAll) return null;
  const seen = new Set(state.tourStepsCompleted);
  for (const step of TOUR_STEP_ORDER) {
    if (!seen.has(step)) return step;
  }
  return null;
}

/**
 * True when the walkthrough is fully resolved — either every step completed
 * or the user explicitly skipped. Used to gate the welcome modal.
 */
export function isWalkthroughComplete(state: OnboardingState): boolean {
  return state.skippedAll || state.tourStepsCompleted.length >= TOUR_STEP_ORDER.length;
}

export type OnboardingAction =
  | { type: "welcome.shown" }
  | { type: "welcome.dismissed"; outcome: "primary" | "skip" | "explore" }
  | { type: "tour.advanced"; step: TourStepId }
  | { type: "tour.skipped" }
  | { type: "first-meeting.seen" };

/**
 * Pure reducer — given a state and an action, return the next state. No side
 * effects, no DOM, no timers. Trivial to unit test and to reason about.
 */
export function reduce(
  state: OnboardingState,
  action: OnboardingAction,
  now: () => string = () => new Date().toISOString(),
): OnboardingState {
  switch (action.type) {
    case "welcome.shown":
      // Shown is not a state change — telemetry only.
      return state;
    case "welcome.dismissed": {
      const skippedAll = action.outcome === "skip";
      return {
        ...state,
        welcomeSeen: true,
        skippedAll: skippedAll || state.skippedAll,
        completedAt: skippedAll ? now() : state.completedAt,
      };
    }
    case "tour.advanced": {
      if (state.tourStepsCompleted.includes(action.step)) return state;
      const tourStepsCompleted = [...state.tourStepsCompleted, action.step];
      const allComplete = tourStepsCompleted.length >= TOUR_STEP_ORDER.length;
      return {
        ...state,
        tourStepsCompleted,
        completedAt: allComplete && !state.completedAt ? now() : state.completedAt,
      };
    }
    case "tour.skipped":
      return {
        ...state,
        skippedAll: true,
        completedAt: state.completedAt ?? now(),
      };
    case "first-meeting.seen":
      return { ...state, firstMeetingSeen: true };
    default:
      return state;
  }
}
