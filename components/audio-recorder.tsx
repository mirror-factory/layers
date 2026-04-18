"use client";

/**
 * Minimal browser microphone recorder.
 *
 * Uses MediaRecorder -> WebM blob. Handed back to the parent via onRecorded.
 * No system audio — browser can't access it. Desktop system audio capture
 * comes in the Tauri shell.
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  disabled?: boolean;
  onRecorded: (blob: Blob) => void;
}

export function AudioRecorder({ disabled, onRecorded }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => stopTracks();
  }, []);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = async () => {
    setError(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });
      streamRef.current = stream;
      const mime = pickMimeType();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        stopTracks();
        setIsRecording(false);
        setElapsed(0);
        onRecorded(blob);
      };
      rec.start(1000);
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((n) => n + 1);
      }, 1000);
    } catch (err) {
      setError(
        `Microphone access failed: ${(err as Error).message}. Check browser permissions.`,
      );
      stopTracks();
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
  };

  return (
    <div className="flex flex-col gap-2">
      {!isRecording ? (
        <button
          type="button"
          onClick={start}
          disabled={disabled}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start recording
        </button>
      ) : (
        <button
          type="button"
          onClick={stop}
          className="rounded-md border border-red-700 bg-red-900/40 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-900/60"
        >
          Stop · {formatElapsed(elapsed)}
        </button>
      )}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

function pickMimeType(): string {
  // iOS WKWebView only supports audio/mp4; desktop browsers prefer webm/opus.
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(c)
    ) {
      return c;
    }
  }
  // Fallback: let the browser pick its default
  return "";
}
