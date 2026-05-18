export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { withExternalCall } from "@/lib/with-external";
import { getAssemblyAI, getBatchSpeechModelsFromSettings } from "@/lib/assemblyai/client";
import { checkQuota } from "@/lib/billing/quota";
import { getMeetingsStore } from "@/lib/meetings/store";
import { getCurrentUserId } from "@/lib/supabase/user";
import { getSupabaseServer } from "@/lib/supabase/server";
import { RECORDINGS_BUCKET } from "@/lib/recording/storage";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// 30 minutes — covers the round-trip from "client kicks off transcription"
// through "AssemblyAI fetches the audio from the signed URL". Beyond this,
// our backend should have already submitted the job.
const SIGNED_DOWNLOAD_EXPIRES_SECONDS = 60 * 30;

export const POST = withRoute(async (req, ctx) => {
  const contentType = req.headers.get("content-type") ?? "";

  // Storage-backed path (PROD-473): caller already uploaded to the recordings
  // bucket via /api/recordings/sign-upload and POSTs only the resulting path
  // here. Required for files larger than Vercel's ~4.5 MB body limit.
  if (contentType.includes("application/json")) {
    return handleStorageBackedTranscribe(req, ctx);
  }

  // Legacy multipart path: server buffers the file end-to-end. Safe for
  // files up to ~4.5 MB; larger files should use the storage-backed path
  // above. Kept for short clips and backward compatibility.
  return handleMultipartTranscribe(req, ctx);
});

async function handleMultipartTranscribe(
  req: Request,
  ctx: { requestId: string },
): Promise<Response> {
  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 },
    );
  }

  const audioFile = formData.get("audio");
  if (!audioFile || !(audioFile instanceof Blob) || audioFile.size === 0) {
    return NextResponse.json(
      { error: "Missing or empty audio file" },
      { status: 400 },
    );
  }

  // Check file size
  if (audioFile.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File exceeds 100MB limit" },
      { status: 413 },
    );
  }

  // Quota check
  const quota = await checkQuota();
  if (!quota.allowed) {
    const limitCopy = quota.reason === "minute_limit"
      ? `${quota.planId} plan minute limit reached (${quota.monthlyMinutesUsed}/${quota.minuteLimit} min this month).`
      : `${quota.planId} plan meeting limit reached (${quota.meetingCount}/${quota.meetingLimit} meetings).`;
    return NextResponse.json(
      {
        error: `${limitCopy} Upgrade to continue.`,
        code: "free_limit_reached",
        upgradeUrl: "/pricing",
      },
      { status: 402 },
    );
  }

  const client = getAssemblyAI();
  if (!client) {
    return NextResponse.json(
      { error: "AssemblyAI is not configured" },
      { status: 502 },
    );
  }

  // Upload file to AssemblyAI
  const buf = Buffer.from(await audioFile.arrayBuffer());

  const uploadUrl = await withExternalCall(
    { vendor: "assemblyai", operation: "files.upload", requestId: ctx.requestId },
    () => client.files.upload(buf),
    { inputSummary: { audioBytes: buf.length } },
  );

  // Submit transcript job
  const speechModels = await getBatchSpeechModelsFromSettings();

  const transcript = await withExternalCall(
    { vendor: "assemblyai", operation: "transcripts.submit", requestId: ctx.requestId },
    () =>
      client.transcripts.submit({
        audio_url: uploadUrl,
        speech_models: speechModels,
        speaker_labels: true,
        entity_detection: true,
        punctuate: true,
        format_text: true,
      }),
    { inputSummary: { speechModels } },
  );

  // Insert placeholder row
  const store = await getMeetingsStore();
  await getCurrentUserId();

  await store.insert({
    id: transcript.id,
    status: "processing",
  });

  return NextResponse.json(
    { id: transcript.id, status: "processing" },
    { status: 202 },
  );
}

async function handleStorageBackedTranscribe(
  req: Request,
  ctx: { requestId: string },
): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const storagePath =
    typeof (body as { storagePath?: unknown })?.storagePath === "string"
      ? (body as { storagePath: string }).storagePath
      : null;
  if (!storagePath || storagePath.length === 0) {
    return NextResponse.json(
      { error: "Missing storagePath" },
      { status: 400 },
    );
  }

  // RLS scoping: the path must start with the caller's user_id so we can
  // be sure they're transcribing their own recording (not pointing the
  // server at someone else's storage path).
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign-in required" },
      { status: 401 },
    );
  }
  const expectedPrefix = `${userId}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "storagePath does not match the authenticated user" },
      { status: 403 },
    );
  }

  // Quota check
  const quota = await checkQuota();
  if (!quota.allowed) {
    const limitCopy = quota.reason === "minute_limit"
      ? `${quota.planId} plan minute limit reached (${quota.monthlyMinutesUsed}/${quota.minuteLimit} min this month).`
      : `${quota.planId} plan meeting limit reached (${quota.meetingCount}/${quota.meetingLimit} meetings).`;
    return NextResponse.json(
      {
        error: `${limitCopy} Upgrade to continue.`,
        code: "free_limit_reached",
        upgradeUrl: "/pricing",
      },
      { status: 402 },
    );
  }

  const client = getAssemblyAI();
  if (!client) {
    return NextResponse.json(
      { error: "AssemblyAI is not configured" },
      { status: 502 },
    );
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      { error: "Storage is not configured" },
      { status: 503 },
    );
  }

  // Mint a short-lived signed download URL — AssemblyAI will fetch from it
  // server-side. We don't read or proxy the audio bytes through the function,
  // so the 4.5 MB body cap doesn't apply.
  const { data: signedDownload, error: signError } = await supabase
    .storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_DOWNLOAD_EXPIRES_SECONDS);

  if (signError || !signedDownload) {
    return NextResponse.json(
      {
        error: "Failed to mint signed download URL for the recording",
        details: signError?.message,
      },
      { status: 502 },
    );
  }

  const speechModels = await getBatchSpeechModelsFromSettings();

  const transcript = await withExternalCall(
    { vendor: "assemblyai", operation: "transcripts.submit", requestId: ctx.requestId },
    () =>
      client.transcripts.submit({
        audio_url: signedDownload.signedUrl,
        speech_models: speechModels,
        speaker_labels: true,
        entity_detection: true,
        punctuate: true,
        format_text: true,
      }),
    { inputSummary: { speechModels, source: "storage-backed" } },
  );

  const store = await getMeetingsStore();
  await store.insert({
    id: transcript.id,
    status: "processing",
  });

  return NextResponse.json(
    { id: transcript.id, status: "processing" },
    { status: 202 },
  );
}
