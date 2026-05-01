import type { Meeting, MeetingListItem } from "@/lib/meetings/types";
import { fixtureUsers } from "./users";

export const fixtureMeetingListItems: Record<
  "ownerPlanning" | "intruderPlanning",
  MeetingListItem & { userId: string }
> = {
  ownerPlanning: {
    id: "meeting_owner_planning",
    userId: fixtureUsers.owner.id,
    title: "Product planning",
    status: "completed",
    durationSeconds: 1800,
    createdAt: "2026-05-01T15:00:00.000Z",
  },
  intruderPlanning: {
    id: "meeting_intruder_planning",
    userId: fixtureUsers.intruder.id,
    title: "Product planning",
    status: "completed",
    durationSeconds: 2400,
    createdAt: "2026-05-01T16:00:00.000Z",
  },
};

export const fixtureMeetings: Record<"ownerPlanning", Meeting & { userId: string }> = {
  ownerPlanning: {
    ...fixtureMeetingListItems.ownerPlanning,
    userId: fixtureUsers.owner.id,
    text: "Owner-only roadmap decisions and launch sequencing.",
    utterances: [
      {
        speaker: "Alex",
        text: "Owner-only roadmap decisions and launch sequencing.",
        start: 0,
        end: 4200,
        confidence: 0.97,
      },
    ],
    summary: null,
    intakeForm: null,
    costBreakdown: null,
    error: null,
    updatedAt: "2026-05-01T15:30:00.000Z",
  },
};
