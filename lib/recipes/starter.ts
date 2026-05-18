/**
 * Starter recipes — seeded for new users on first GET /api/account/recipes.
 *
 * These are the 5 templates that used to live hardcoded in
 * components/meeting-chat.tsx (Sales / Interview / Standup / Follow-up /
 * Intake). Lifting them out of the chat-meeting bag and into a per-user
 * library lets users edit, rename, and add their own — see PROD-463.
 *
 * Names + prompts kept stable so users who knew the old chip labels
 * still recognise them post-migration.
 */

import type { RecipeCreate } from "./types";

export const STARTER_RECIPES: ReadonlyArray<RecipeCreate> = [
  {
    name: "Sales discovery",
    prompt:
      "Use this meeting to create a sales discovery brief with pain points, budget signals, decision makers, objections, next steps, risks, and transcript segment citations.",
  },
  {
    name: "Interview debrief",
    prompt:
      "Use this meeting to create an interview debrief with candidate strengths, concerns, evidence from the conversation, follow-ups, and a hiring recommendation.",
  },
  {
    name: "Standup summary",
    prompt:
      "Use this meeting to create a standup summary with progress, blockers, decisions, owners, and action items.",
  },
  {
    name: "Follow-up email",
    prompt:
      "Draft a concise follow-up email from this meeting. Include decisions, commitments, owners, deadlines, and cite transcript segments in a notes section.",
  },
  {
    name: "Intake record",
    prompt:
      "Turn this meeting into an intake record with intent, budget, timeline, decision makers, requirements, pain points, risks, next steps, and segment citations.",
  },
] as const;
