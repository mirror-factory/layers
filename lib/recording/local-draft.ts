export interface LocalRecordingDraft {
  meetingId: string;
  updatedAt: string;
  durationSeconds: number;
  text: string;
  title?: string | null;
  turnCount: number;
  partial: string;
  providerModel?: string;
}

export interface RecordingDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const DRAFT_PREFIX = "layers-recording-draft:";
const LATEST_KEY = "layers-recording-draft:latest";

export function recordingDraftKey(meetingId: string): string {
  return `${DRAFT_PREFIX}${meetingId}`;
}

export function readLocalRecordingDraft(
  storage: RecordingDraftStorage | null,
  meetingId: string,
): LocalRecordingDraft | null {
  if (!storage || !meetingId) return null;

  try {
    const raw = storage.getItem(recordingDraftKey(meetingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalRecordingDraft;
    if (!parsed.meetingId || typeof parsed.text !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Decides which of two drafts is "newer" for the same meeting. Used to guard
 * against a lagging tab clobbering a more advanced session (PROD-475 AC4).
 *
 * Ordering, in priority order:
 *   1. higher `turnCount` wins (last-writer-wins on actual transcript progress)
 *   2. higher `durationSeconds` wins (clock-skew-safe fallback)
 *   3. newer `updatedAt` wins (final tiebreaker; tolerates skew via #1/#2)
 *
 * Returning the candidate when the meetings differ is a defensive no-op --
 * callers should never compare across meeting ids.
 */
export function pickFresherRecordingDraft(
  current: LocalRecordingDraft | null,
  candidate: LocalRecordingDraft,
): LocalRecordingDraft {
  if (!current) return candidate;
  if (current.meetingId !== candidate.meetingId) return candidate;

  if (candidate.turnCount > current.turnCount) return candidate;
  if (candidate.turnCount < current.turnCount) return current;

  if (candidate.durationSeconds > current.durationSeconds) return candidate;
  if (candidate.durationSeconds < current.durationSeconds) return current;

  const currentTs = Date.parse(current.updatedAt);
  const candidateTs = Date.parse(candidate.updatedAt);
  if (!Number.isFinite(candidateTs)) return current;
  if (!Number.isFinite(currentTs)) return candidate;
  return candidateTs >= currentTs ? candidate : current;
}

export function saveLocalRecordingDraft(
  storage: RecordingDraftStorage | null,
  draft: LocalRecordingDraft,
): boolean {
  if (!storage || !draft.meetingId) return false;

  try {
    // Last-writer-wins on actual progress: if another tab has already mirrored
    // a more-advanced draft for the same meeting, don't regress it. This keeps
    // the lagging-tab case (PROD-475 AC4) from clobbering the leader.
    const existing = readLocalRecordingDraft(storage, draft.meetingId);
    const winner = pickFresherRecordingDraft(existing, draft);

    const serialized = JSON.stringify(winner);
    storage.setItem(recordingDraftKey(draft.meetingId), serialized);
    storage.setItem(LATEST_KEY, draft.meetingId);
    return winner === draft;
  } catch {
    return false;
  }
}

export function clearLocalRecordingDraft(
  storage: RecordingDraftStorage | null,
  meetingId: string,
): boolean {
  if (!storage || !meetingId) return false;

  try {
    storage.removeItem(recordingDraftKey(meetingId));
    if (storage.getItem(LATEST_KEY) === meetingId) {
      storage.removeItem(LATEST_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

export function readLatestLocalRecordingDraft(
  storage: RecordingDraftStorage | null,
): LocalRecordingDraft | null {
  if (!storage) return null;

  try {
    const latestMeetingId = storage.getItem(LATEST_KEY);
    if (!latestMeetingId) return null;
    return readLocalRecordingDraft(storage, latestMeetingId);
  } catch {
    return null;
  }
}

/**
 * Streaming-token expiry guard used during long live sessions (PROD-475 AC5).
 *
 * The recorder mints a temporary token with a server-side TTL (currently 600s
 * for both AssemblyAI and Deepgram). For sessions that approach the TTL we
 * want to refresh the token *before* the provider closes the socket, otherwise
 * already-finalized turns could be lost to an abrupt close. This helper is
 * pure -- callers pass in `Date.now()` (or a fake clock in tests) so we don't
 * depend on global state.
 *
 * `skewSafetyMs` widens the "expiring soon" window to absorb clock skew
 * between the browser and the provider (default 30s).
 */
export function shouldRefreshStreamingToken(
  expiresAt: number | null | undefined,
  nowMs: number,
  skewSafetyMs = 30_000,
): boolean {
  if (!expiresAt || !Number.isFinite(expiresAt)) return false;
  return expiresAt - nowMs <= skewSafetyMs;
}
