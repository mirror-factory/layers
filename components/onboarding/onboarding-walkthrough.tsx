"use client";

/**
 * OnboardingWalkthrough — the orchestrator surface mounted on `/record`.
 *
 * Pulls state from the OnboardingProvider, decides whether to render the
 * WelcomeModal or the TourPopover, and maps tour step ids to anchor
 * attributes. Anchors are defined as `data-onboarding-anchor="<id>"` on
 * concrete DOM elements in `app/recorder.tsx`.
 *
 * Keep this component dumb — all branching logic lives here so the
 * underlying primitives stay reusable.
 */

import { useOnboarding } from "./onboarding-provider";
import { WelcomeModal } from "./welcome-modal";
import { TourPopover } from "./tour-popover";
import { ONBOARDING_ANCHORS, TOUR_STEP_ORDER } from "@/lib/onboarding/copy";

export function OnboardingWalkthrough() {
  const {
    ready,
    showWelcome,
    activeTourStep,
    dismissWelcome,
    advanceTour,
    skipTour,
  } = useOnboarding();

  if (!ready) return null;

  if (showWelcome) {
    return (
      <WelcomeModal
        open
        onDismiss={(outcome) => {
          // "primary" and "explore" both keep the tour alive — the next
          // tooltip will surface once the welcome modal closes.
          dismissWelcome(outcome);
        }}
      />
    );
  }

  if (!activeTourStep) return null;

  const anchorKey = ONBOARDING_ANCHORS[activeTourStep];
  const isLast =
    TOUR_STEP_ORDER.indexOf(activeTourStep) === TOUR_STEP_ORDER.length - 1;

  return (
    <TourPopover
      step={activeTourStep}
      anchorKey={anchorKey}
      isLast={isLast}
      onAdvance={() => advanceTour(activeTourStep)}
      onSkip={skipTour}
    />
  );
}
