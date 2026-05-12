"use client";

/**
 * OnboardingProvider — context + state management for the first-run
 * walkthrough and first-meeting helper (PROD-389).
 *
 * Responsibilities:
 *   - Hydrates state from localStorage exactly once on mount. Until hydration
 *     finishes, nothing renders — this prevents the welcome modal from
 *     flashing in front of returning users on slow connections.
 *   - Persists every state change back to localStorage.
 *   - Emits telemetry via a "onboarding.step" CustomEvent on `window`.
 *     We deliberately do not call into `lib/logger.ts` from the client —
 *     that logger is server-only. A future change will pipe these events
 *     to /api/onboarding/state along with remote persistence.
 *   - Exposes a compact imperative API via `useOnboarding()`.
 *
 * Hydration timing: we wait for one `useEffect` tick before considering
 * state "ready". Components that block on first paint (RecorderHome's
 * welcome modal) should respect `ready` and render nothing until it flips
 * true.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  INITIAL_STATE,
  ONBOARDING_STORAGE_KEY,
  isWalkthroughComplete,
  nextTourStep,
  parseOnboardingState,
  reduce,
  serializeOnboardingState,
  type OnboardingAction,
  type OnboardingState,
} from "@/lib/onboarding/state";
import type { TourStepId } from "@/lib/onboarding/copy";

interface OnboardingApi {
  state: OnboardingState;
  ready: boolean;
  /** True iff the welcome modal should render right now. */
  showWelcome: boolean;
  /** The current tour step to show, or null when the tour is done/skipped. */
  activeTourStep: TourStepId | null;
  dismissWelcome: (outcome: "primary" | "skip" | "explore") => void;
  advanceTour: (step: TourStepId) => void;
  skipTour: () => void;
  markFirstMeetingSeen: () => void;
  /** Reset onboarding entirely. Useful for QA / a future "show tour again" toggle. */
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingApi | null>(null);

type InternalState = OnboardingState & { _ready: boolean };

const INTERNAL_INITIAL: InternalState = { ...INITIAL_STATE, _ready: false };

type InternalAction =
  | { type: "hydrate"; payload: OnboardingState }
  | { type: "reset" }
  | { type: "user"; payload: OnboardingAction };

function internalReducer(
  state: InternalState,
  action: InternalAction,
): InternalState {
  switch (action.type) {
    case "hydrate":
      return { ...action.payload, _ready: true };
    case "reset":
      return { ...INITIAL_STATE, _ready: true };
    case "user":
      return { ...reduce(state, action.payload), _ready: state._ready };
    default:
      return state;
  }
}

function safeReadStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeWriteStorage(value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, value);
  } catch {
    // Storage may be disabled (private browsing on some platforms).
    // Onboarding will simply re-fire next session — acceptable.
  }
}

function emitTelemetry(detail: {
  step_id: string;
  action: "shown" | "advanced" | "dismissed" | "skipped_all";
  elapsed_ms: number;
}): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("onboarding.step", { detail }));
  } catch {
    // No-op — telemetry is best-effort.
  }
}

export interface OnboardingProviderProps {
  children: ReactNode;
  /**
   * When provided, hydrates from a known state instead of localStorage.
   * Used by tests and Storybook.
   */
  initialState?: OnboardingState;
}

export function OnboardingProvider({
  children,
  initialState,
}: OnboardingProviderProps) {
  const [state, dispatch] = useReducer(internalReducer, INTERNAL_INITIAL);
  const sessionStartRef = useRef<number>(0);

  // Hydrate once on mount.
  useEffect(() => {
    sessionStartRef.current = Date.now();
    if (initialState) {
      dispatch({ type: "hydrate", payload: initialState });
      return;
    }
    const raw = safeReadStorage();
    dispatch({ type: "hydrate", payload: parseOnboardingState(raw) });
  }, [initialState]);

  // Persist after every user action. We strip the internal `_ready` flag
  // before writing so the on-disk shape stays clean.
  useEffect(() => {
    if (!state._ready) return;
    const { _ready: _unused, ...persisted } = state;
    void _unused;
    safeWriteStorage(serializeOnboardingState(persisted));
  }, [state]);

  const fire = useCallback(
    (
      payload: OnboardingAction,
      telemetry: {
        step_id: string;
        action: "shown" | "advanced" | "dismissed" | "skipped_all";
      },
    ) => {
      dispatch({ type: "user", payload });
      emitTelemetry({
        ...telemetry,
        elapsed_ms:
          sessionStartRef.current > 0
            ? Date.now() - sessionStartRef.current
            : 0,
      });
    },
    [],
  );

  const api = useMemo<OnboardingApi>(() => {
    const { _ready, ...persisted } = state;
    void _ready;
    const publicState: OnboardingState = persisted;
    const tourStep = nextTourStep(publicState);

    return {
      state: publicState,
      ready: state._ready,
      showWelcome:
        state._ready &&
        !publicState.welcomeSeen &&
        !publicState.skippedAll &&
        !isWalkthroughComplete(publicState),
      activeTourStep:
        state._ready && publicState.welcomeSeen ? tourStep : null,
      dismissWelcome: (outcome) =>
        fire(
          { type: "welcome.dismissed", outcome },
          {
            step_id: "welcome",
            action: outcome === "skip" ? "skipped_all" : "dismissed",
          },
        ),
      advanceTour: (step) =>
        fire(
          { type: "tour.advanced", step },
          { step_id: step, action: "advanced" },
        ),
      skipTour: () =>
        fire(
          { type: "tour.skipped" },
          { step_id: "tour", action: "skipped_all" },
        ),
      markFirstMeetingSeen: () =>
        fire(
          { type: "first-meeting.seen" },
          { step_id: "first-meeting", action: "shown" },
        ),
      reset: () => dispatch({ type: "reset" }),
    };
  }, [state, fire]);

  return (
    <OnboardingContext.Provider value={api}>
      {children}
    </OnboardingContext.Provider>
  );
}

/**
 * Read the onboarding API. Returns a stable null-object when called outside
 * a provider so that route segments without an OnboardingProvider don't
 * crash — they simply see "everything completed", which is the safe default.
 */
const NULL_API: OnboardingApi = {
  state: { ...INITIAL_STATE, welcomeSeen: true, skippedAll: true },
  ready: true,
  showWelcome: false,
  activeTourStep: null,
  dismissWelcome: () => {},
  advanceTour: () => {},
  skipTour: () => {},
  markFirstMeetingSeen: () => {},
  reset: () => {},
};

export function useOnboarding(): OnboardingApi {
  return useContext(OnboardingContext) ?? NULL_API;
}
