"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import {
  microphoneUnsupportedMessage,
  recordingStartErrorMessage,
} from "@/lib/recording/microphone-errors";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
}

type RecordingMode = "idle" | "recording" | "stopping";

export function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [mode, setMode] = useState<RecordingMode>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recording = mode === "recording";
  const stopping = mode === "stopping";

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(microphoneUnsupportedMessage());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onRecordingComplete(blob);
        stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
        setMode("idle");
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setMode("recording");
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      setError(recordingStartErrorMessage(err));
      setMode("idle");
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      setMode("stopping");
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={stopping}
          className={`flex items-center justify-center w-20 h-20 rounded-full transition-all duration-200 ${
            recording || stopping
              ? "bg-signal-live hover:bg-[#dc2626] text-white"
              : "bg-layers-mint hover:bg-brand-accent-subtle text-white"
          }`}
          aria-label={
            stopping
              ? "Finishing recording"
              : recording
                ? "Stop recording"
                : "Start recording"
          }
          aria-busy={stopping}
        >
          {stopping ? (
            <Loader2 size={28} className="recording-control-spinner" />
          ) : recording ? (
            <Square size={28} />
          ) : (
            <Mic size={28} />
          )}
        </button>

        {recording && (
          <span className="recording-record-ring absolute inset-0 rounded-full border-2 border-layers-mint pointer-events-none" />
        )}
      </div>

      {(recording || stopping) && (
        <div className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">
          {formatDuration(duration)}
        </div>
      )}

      {stopping && (
        <div className="recording-transition-status" role="status">
          Preparing upload
        </div>
      )}

      {error && (
        <p className="text-sm text-signal-live text-center max-w-xs">{error}</p>
      )}
    </div>
  );
}
