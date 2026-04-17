/**
 * Shared types for the transcribe API routes.
 *
 * Keeping the Client<->Server contract in one place makes the /record page
 * and the /api/transcribe routes fail typecheck together if either drifts.
 */

import type { MeetingSummary } from "./schema";

export type TranscribeStatus = "queued" | "processing" | "completed" | "error";

export interface TranscribeStartResponse {
  id: string;
  status: TranscribeStatus;
}

export interface TranscribeUtterance {
  speaker: string | null;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TranscribeResultResponse {
  id: string;
  status: TranscribeStatus;
  /** Present when status === 'completed' */
  text?: string;
  utterances?: TranscribeUtterance[];
  durationSeconds?: number;
  summary?: MeetingSummary;
  /** Present when status === 'error' */
  error?: string;
}
