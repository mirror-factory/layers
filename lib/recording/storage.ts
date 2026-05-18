/**
 * Storage-backed recording uploads (PROD-473).
 *
 * Vercel limits POST request bodies to ~4.5 MB on serverless functions, but
 * a 30-minute meeting can easily exceed 30 MB compressed. The legacy
 * /api/transcribe multipart path silently fails for any non-trivial length.
 *
 * Flow:
 *   1. Client POSTs metadata (mime, size) to /api/recordings/sign-upload.
 *   2. Server returns a signed PUT URL + the chosen storage path
 *      "<user_id>/<uuid>.<ext>".
 *   3. Client uploads the file body directly to the signed URL.
 *   4. Client POSTs { storagePath } to /api/transcribe.
 *   5. Server mints a short-lived signed download URL and submits to
 *      AssemblyAI's transcripts.submit endpoint.
 *
 * RLS on the `recordings` bucket enforces folder-per-user isolation; see
 * supabase/migrations/00007_recordings_storage_bucket.sql for policies.
 */

import { z } from "zod";

export const RECORDINGS_BUCKET = "recordings";

/** Hard cap matches MAX_FILE_SIZE in /api/transcribe and the bucket's
 * file_size_limit. 100 MB. */
export const MAX_RECORDING_BYTES = 100 * 1024 * 1024;

/** Threshold above which the client should prefer the storage-backed path.
 * Set well below Vercel's 4.5 MB request body limit to leave room for
 * multipart overhead. */
export const STORAGE_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
};

export const ALLOWED_RECORDING_MIME_TYPES = Object.freeze(
  Object.keys(MIME_TO_EXT),
);

export function fileExtensionForMime(mime: string): string | null {
  return MIME_TO_EXT[mime] ?? null;
}

/**
 * Compose the storage path for a recording. Folder must equal auth.uid()
 * exactly so the RLS policy on storage.objects accepts the insert.
 *
 * The uuid argument is parameterised for testability. Callers in production
 * should pass crypto.randomUUID().
 */
export function buildRecordingPath(
  userId: string,
  uuid: string,
  mimeType: string,
): string | null {
  const ext = fileExtensionForMime(mimeType);
  if (!ext) return null;
  return `${userId}/${uuid}.${ext}`;
}

/** Request schema for POST /api/recordings/sign-upload. */
export const signUploadRequestSchema = z.object({
  contentType: z.string().refine(
    (v) => ALLOWED_RECORDING_MIME_TYPES.includes(v),
    { message: "unsupported audio mime type" },
  ),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_RECORDING_BYTES, {
      message: `file exceeds ${MAX_RECORDING_BYTES}-byte cap`,
    }),
});

export type SignUploadRequest = z.infer<typeof signUploadRequestSchema>;

/** Response schema for POST /api/recordings/sign-upload. */
export const signUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  storagePath: z.string(),
  token: z.string(),
  expiresInSeconds: z.number().int().positive(),
});

export type SignUploadResponse = z.infer<typeof signUploadResponseSchema>;
