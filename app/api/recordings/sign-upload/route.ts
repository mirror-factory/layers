/**
 * POST /api/recordings/sign-upload
 *
 * PROD-473: returns a signed PUT URL for the recordings bucket so the client
 * can upload audio files larger than Vercel's ~4.5 MB body limit.
 *
 * Auth: caller must be signed in. The chosen storage path is always prefixed
 * with the caller's user_id so the RLS policies on storage.objects (see
 * supabase/migrations/00007_recordings_storage_bucket.sql) admit the insert
 * when the client uploads using the signed URL token.
 *
 * Body: { contentType, sizeBytes } — see signUploadRequestSchema.
 * Response: { uploadUrl, storagePath, token, expiresInSeconds }.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { withRoute } from "@/lib/with-route";
import { getCurrentUserId } from "@/lib/supabase/user";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  RECORDINGS_BUCKET,
  buildRecordingPath,
  signUploadRequestSchema,
} from "@/lib/recording/storage";

const SIGNED_URL_EXPIRES_SECONDS = 60 * 30; // 30 minutes

export const POST = withRoute(async (req) => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign-in required to upload recordings." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = signUploadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const storagePath = buildRecordingPath(
    userId,
    randomUUID(),
    parsed.data.contentType,
  );
  if (!storagePath) {
    return NextResponse.json(
      { error: "Unsupported audio mime type" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      { error: "Storage is not configured" },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .storage
    .from(RECORDINGS_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return NextResponse.json(
      {
        error: "Failed to mint signed upload URL",
        details: error?.message,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    storagePath: data.path ?? storagePath,
    token: data.token,
    expiresInSeconds: SIGNED_URL_EXPIRES_SECONDS,
  });
});
