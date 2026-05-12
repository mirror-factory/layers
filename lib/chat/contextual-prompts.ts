/**
 * Context-aware quick-chip prompts for the chat surfaces.
 *
 * Per PROD-462 / docs/COMPETITIVE_UX.md §5 #2, the static 5-template array
 * (Sales / Interview / Standup / Follow-up / Intake) is being replaced with
 * surface-specific, user-voice prompts. The Recipes migration of the prior
 * templates is tracked in PROD-463 — they are intentionally not re-exported here.
 *
 * Prompts use the `{participant}` token where a runtime participant name can be
 * interpolated. Call {@link interpolateParticipant} to substitute it; if no
 * name is available the token is replaced with a neutral fallback so the chip
 * is still tappable.
 */

export const PARTICIPANT_TOKEN = "{participant}";

/** Fallback used when no participant name is known for a meeting. */
export const PARTICIPANT_FALLBACK = "the team";

/** Prompts shown on the meeting detail surface (`/meetings/[id]`). */
export const MEETING_PROMPTS = [
  "What did we decide?",
  "Owner and deadlines",
  `Draft a follow-up to ${PARTICIPANT_TOKEN}`,
  "Risks I should flag",
] as const;

/** Prompts shown on the global library chat surface (`/chat`). */
export const LIBRARY_PROMPTS = [
  "What did I commit to this week?",
  "Recurring blockers",
  "Customers asking about pricing",
  "Decisions across last 5 meetings",
] as const;

/** Sample question rendered in the empty state as if the user just typed it. */
export const LIBRARY_EMPTY_STATE_SAMPLE =
  "What were the decisions in my last 3 meetings?";

export type MeetingPrompt = (typeof MEETING_PROMPTS)[number];
export type LibraryPrompt = (typeof LIBRARY_PROMPTS)[number];

export type ChatSurface = "meeting" | "library";

/**
 * Return the prompt list for a given surface. Useful for surface-driven
 * rendering and for tests that assert the right surface returns the right
 * prompts.
 */
export function getPromptsForSurface(
  surface: "meeting",
): readonly MeetingPrompt[];
export function getPromptsForSurface(
  surface: "library",
): readonly LibraryPrompt[];
export function getPromptsForSurface(
  surface: ChatSurface,
): readonly string[];
export function getPromptsForSurface(
  surface: ChatSurface,
): readonly string[] {
  return surface === "meeting" ? MEETING_PROMPTS : LIBRARY_PROMPTS;
}

/**
 * Replace the `{participant}` token in a prompt with the provided participant
 * name. Falls back to {@link PARTICIPANT_FALLBACK} when the name is missing,
 * empty, or whitespace-only.
 *
 * Replaces every occurrence of the token (not just the first) so callers don't
 * need to worry about how many times it appears in future prompts.
 */
export function interpolateParticipant(
  prompt: string,
  participantName?: string | null,
): string {
  const trimmed =
    typeof participantName === "string" ? participantName.trim() : "";
  const replacement = trimmed.length > 0 ? trimmed : PARTICIPANT_FALLBACK;
  return prompt.split(PARTICIPANT_TOKEN).join(replacement);
}
