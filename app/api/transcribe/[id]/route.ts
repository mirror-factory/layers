/**
 * GET /api/transcribe/[id]
 *
 * Client polls this until status === 'completed' or 'error'.
 * On first successful completion we generate a structured summary via
 * the Gateway (Claude Sonnet 4.6 by default) and cache it in-memory so
 * subsequent polls don't re-bill the LLM. The summary call is traced by
 * Langfuse via withTelemetry inside summarizeMeeting().
 */

import { NextResponse } from "next/server";
import { getAssemblyAI } from "@/lib/assemblyai/client";
import { summarizeMeeting } from "@/lib/assemblyai/summary";
import { cacheSummary, getCachedSummary } from "@/lib/assemblyai/cache";
import type {
  TranscribeResultResponse,
  TranscribeStatus,
  TranscribeUtterance,
} from "@/lib/assemblyai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const client = getAssemblyAI();

  let transcript;
  try {
    transcript = await client.transcripts.get(id);
  } catch (err) {
    console.error("AssemblyAI get failed", err);
    return NextResponse.json(
      { error: `Fetch transcript failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const status: TranscribeStatus = mapStatus(transcript.status);

  if (status !== "completed") {
    const body: TranscribeResultResponse = {
      id,
      status,
      error: transcript.error ?? undefined,
    };
    return NextResponse.json(body);
  }

  // Completed path — extract utterances, maybe summarize.
  const utterances: TranscribeUtterance[] =
    (transcript.utterances ?? []).map((u) => ({
      speaker: u.speaker ?? null,
      text: u.text,
      start: u.start,
      end: u.end,
      confidence: u.confidence,
    }));

  let summary = getCachedSummary(id);
  if (!summary) {
    try {
      summary = await summarizeMeeting({
        transcriptId: id,
        utterances: utterances.map((u) => ({
          speaker: u.speaker,
          text: u.text,
        })),
        fullText: transcript.text ?? undefined,
      });
      cacheSummary(id, summary);
    } catch (err) {
      // Surface the transcript even if the summary fails — partial success
      // is more useful than a 500 that hides the completed transcription.
      console.error("Summary generation failed", err);
    }
  }

  const body: TranscribeResultResponse = {
    id,
    status: "completed",
    text: transcript.text ?? "",
    utterances,
    durationSeconds: transcript.audio_duration ?? undefined,
    summary,
  };
  return NextResponse.json(body);
}

function mapStatus(s: string | null | undefined): TranscribeStatus {
  if (s === "completed") return "completed";
  if (s === "error") return "error";
  if (s === "queued") return "queued";
  return "processing";
}
