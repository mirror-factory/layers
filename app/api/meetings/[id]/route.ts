export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/with-route";
import { getMeetingsStore } from "@/lib/meetings/store";
import type { Meeting } from "@/lib/meetings/types";

const meetingPatchSchema = z.object({
  userNotes: z.string().max(50_000).nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "Provide at least one field to update" },
);

const EMPTY_RECORDING_SECONDS_THRESHOLD = 30;

function isEmptyMeeting(meeting: Meeting): boolean {
  const hasTranscriptText = Boolean(meeting.text?.trim());
  const hasUtterances = meeting.utterances.some((turn) =>
    Boolean(turn.text?.trim()),
  );
  const hasSummary = meeting.summary !== null;

  return (
    !hasTranscriptText &&
    !hasUtterances &&
    !hasSummary &&
    (meeting.durationSeconds ?? 0) < EMPTY_RECORDING_SECONDS_THRESHOLD
  );
}

export const GET = withRoute(async (req, ctx) => {
  const id = ctx.params?.id as string;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const store = await getMeetingsStore();
  const meeting = await store.get(id);

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  return NextResponse.json(meeting);
});

export const PATCH = withRoute(async (req, ctx) => {
  const id = ctx.params?.id as string;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = meetingPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const store = await getMeetingsStore();
  const updated = await store.update(id, parsed.data);

  if (!updated) {
    return NextResponse.json(
      { error: "Meeting not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(updated);
});

export const DELETE = withRoute(async (req, ctx) => {
  const id = ctx.params?.id as string;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const store = await getMeetingsStore();
  const meeting = await store.get(id);

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (!isEmptyMeeting(meeting)) {
    return NextResponse.json(
      { error: "Only empty recordings can be deleted from this shortcut" },
      { status: 409 },
    );
  }

  const deleted = await store.delete(id);
  if (!deleted) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
});
