import { describe, expect, it } from "vitest";
import {
  ALLOWED_RECORDING_MIME_TYPES,
  MAX_RECORDING_BYTES,
  STORAGE_UPLOAD_THRESHOLD_BYTES,
  buildRecordingPath,
  fileExtensionForMime,
  signUploadRequestSchema,
} from "@/lib/recording/storage";

describe("recording storage helpers (PROD-473)", () => {
  describe("fileExtensionForMime", () => {
    it("maps known audio mime types to file extensions", () => {
      expect(fileExtensionForMime("audio/webm")).toBe("webm");
      expect(fileExtensionForMime("audio/mp4")).toBe("m4a");
      expect(fileExtensionForMime("audio/x-m4a")).toBe("m4a");
      expect(fileExtensionForMime("audio/mpeg")).toBe("mp3");
      expect(fileExtensionForMime("audio/wav")).toBe("wav");
    });

    it("returns null for unknown mime types", () => {
      expect(fileExtensionForMime("video/mp4")).toBeNull();
      expect(fileExtensionForMime("image/png")).toBeNull();
      expect(fileExtensionForMime("")).toBeNull();
    });
  });

  describe("buildRecordingPath", () => {
    it("composes path with user_id prefix so RLS folder policy admits it", () => {
      const path = buildRecordingPath(
        "11111111-2222-3333-4444-555555555555",
        "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "audio/webm",
      );
      expect(path).toBe(
        "11111111-2222-3333-4444-555555555555/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.webm",
      );
    });

    it("returns null when mime is unsupported", () => {
      const path = buildRecordingPath("u1", "x", "video/quicktime");
      expect(path).toBeNull();
    });

    it("first path segment always equals the user id", () => {
      const path = buildRecordingPath("user_a", "uuid_b", "audio/mp4");
      expect(path).not.toBeNull();
      expect(path!.split("/")[0]).toBe("user_a");
    });
  });

  describe("signUploadRequestSchema", () => {
    it("accepts a well-formed request", () => {
      const result = signUploadRequestSchema.safeParse({
        contentType: "audio/webm",
        sizeBytes: 10 * 1024 * 1024,
      });
      expect(result.success).toBe(true);
    });

    it("rejects an unsupported mime", () => {
      const result = signUploadRequestSchema.safeParse({
        contentType: "video/mp4",
        sizeBytes: 1024,
      });
      expect(result.success).toBe(false);
    });

    it("rejects size above the 100MB cap", () => {
      const result = signUploadRequestSchema.safeParse({
        contentType: "audio/webm",
        sizeBytes: MAX_RECORDING_BYTES + 1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative size", () => {
      const result = signUploadRequestSchema.safeParse({
        contentType: "audio/webm",
        sizeBytes: -1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer size", () => {
      const result = signUploadRequestSchema.safeParse({
        contentType: "audio/webm",
        sizeBytes: 1024.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("constants", () => {
    it("STORAGE_UPLOAD_THRESHOLD_BYTES stays under Vercel's 4.5 MB cap", () => {
      expect(STORAGE_UPLOAD_THRESHOLD_BYTES).toBeLessThan(4.5 * 1024 * 1024);
    });

    it("ALLOWED_RECORDING_MIME_TYPES covers the formats the bucket policy allows", () => {
      expect(ALLOWED_RECORDING_MIME_TYPES).toContain("audio/webm");
      expect(ALLOWED_RECORDING_MIME_TYPES).toContain("audio/mp4");
      expect(ALLOWED_RECORDING_MIME_TYPES).toContain("audio/mpeg");
      expect(ALLOWED_RECORDING_MIME_TYPES).toContain("audio/wav");
    });
  });
});
