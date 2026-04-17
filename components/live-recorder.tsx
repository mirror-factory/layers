"use client";

/**
 * Live streaming recorder.
 *
 * Flow:
 *   1. POST /api/transcribe/stream/token -> { token, meetingId }
 *   2. getUserMedia + AudioContext + AudioWorklet (pcm-downsampler)
 *      produce 16kHz int16 PCM chunks
 *   3. Import `assemblyai/streaming` (browser build resolved by the
 *      package exports field) and open a StreamingTranscriber with
 *      the temp token and speechModel=u3-rt-pro
 *   4. `turn` events -> update live UI; finalized turns append to a
 *      local array
 *   5. Stop button -> close WS, POST /api/transcribe/stream/finalize
 *      with the accumulated transcript, redirect to /meetings/[id]
 *
 * State is kept local to this component; the final write to the
 * MeetingsStore happens server-side in finalize so a browser crash
 * doesn't lose persistence (the row already exists as 'processing').
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveTranscriptView } from "./live-transcript-view";
import { isTauri, loadTauriBridge } from "@/lib/tauri/bridge";

export interface LiveTurn {
  id: string;
  speaker: string | null;
  text: string;
  startMs: number;
  endMs: number;
}

type Stage = "idle" | "starting" | "live" | "stopping" | "error";

interface TokenResponse {
  token: string;
  meetingId: string;
  expiresAt: number;
  sampleRate: number;
  speechModel: string;
}

export function LiveRecorder() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finalizedTurns, setFinalizedTurns] = useState<LiveTurn[]>([]);
  const [partial, setPartial] = useState<LiveTurn | null>(null);

  // Refs hold the mutable pieces of the pipeline so unmount cleanup
  // can tear them down without dragging state through re-renders.
  const transcriberRef = useRef<
    import("assemblyai").StreamingTranscriber | null
  >(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meetingIdRef = useRef<string | null>(null);
  const finalizedRef = useRef<LiveTurn[]>([]);

  const usingTauriRef = useRef(false);

  const teardown = useCallback(async () => {
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      try {
        await transcriberRef.current?.close(true);
      } catch {
        /* ignore */
      }
      transcriberRef.current = null;
      if (usingTauriRef.current) {
        const bridge = await loadTauriBridge();
        await bridge?.invoke("stop_mic_capture").catch(() => {});
        usingTauriRef.current = false;
      }
      workletNodeRef.current?.disconnect();
      workletNodeRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      await audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  const start = async () => {
    setError(null);
    setFinalizedTurns([]);
    setPartial(null);
    finalizedRef.current = [];
    setElapsed(0);
    setStage("starting");

    let token: TokenResponse;
    try {
      const res = await fetch("/api/transcribe/stream/token", {
        method: "POST",
      });
      if (res.status === 402) {
        const data = await res
          .json()
          .catch(() => ({ error: "Free-tier limit reached." }));
        throw new Error(
          `${data.error ?? "Free-tier limit reached."} Visit /pricing to subscribe.`,
        );
      }
      if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
      token = (await res.json()) as TokenResponse;
    } catch (err) {
      setError((err as Error).message);
      setStage("error");
      return;
    }
    meetingIdRef.current = token.meetingId;

    try {
      await openMicAndConnect(token);
    } catch (err) {
      setError(`Failed to start live transcription: ${(err as Error).message}`);
      setStage("error");
      await teardown();
      return;
    }

    startedAtRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed((Date.now() - startedAtRef.current) / 1000);
    }, 250);
    setStage("live");
  };

  const openMicAndConnect = async (token: TokenResponse) => {
    // Late browser-only import so server bundle doesn't pull WS shims.
    // Next.js picks the `browser` export condition for client chunks,
    // which bundles the Web WebSocket-backed StreamingTranscriber.
    const { StreamingTranscriber } = await import("assemblyai");

    const transcriber = new StreamingTranscriber({
      token: token.token,
      sampleRate: token.sampleRate,
      speechModel:
        token.speechModel as import("assemblyai").StreamingSpeechModel,
      formatTurns: true,
      speakerLabels: true,
    });
    transcriberRef.current = transcriber;

    transcriber.on("turn", (event) => {
      const turn: LiveTurn = {
        id: `${event.turn_order}`,
        speaker: event.speaker_label ?? null,
        text: event.transcript,
        startMs: event.words[0]?.start ?? 0,
        endMs: event.words[event.words.length - 1]?.end ?? 0,
      };
      if (event.end_of_turn) {
        finalizedRef.current = [...finalizedRef.current, turn];
        setFinalizedTurns(finalizedRef.current);
        setPartial(null);
      } else {
        setPartial(turn);
      }
    });

    transcriber.on("error", (err) => {
      console.error("StreamingTranscriber error", err);
      setError(err.message);
      setStage("error");
    });

    await transcriber.connect();

    // Audio source: prefer the native Tauri cpal capture when running
    // inside the desktop shell (avoids the getUserMedia permission
    // dialog and gives us a clean handoff for future system-audio
    // mixing). Falls back to AudioWorklet in any normal browser.
    if (isTauri()) {
      const bridge = await loadTauriBridge();
      if (bridge) {
        const channel = bridge.channel<ArrayBuffer | number[]>();
        channel.onMessage((data) => {
          try {
            const buf = data instanceof ArrayBuffer
              ? data
              : new Uint8Array(data).buffer;
            transcriber.sendAudio(buf);
          } catch {
            /* ignore transient: closed socket during teardown */
          }
        });
        await bridge.invoke("start_mic_capture", { onChunk: channel.raw });
        usingTauriRef.current = true;
        return;
      }
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    });
    mediaStreamRef.current = stream;

    const ctx = new AudioContext();
    audioContextRef.current = ctx;
    await ctx.audioWorklet.addModule("/worklets/pcm-downsampler.js");

    const source = ctx.createMediaStreamSource(stream);
    // Anti-alias before decimation. Speech fits under 7 kHz comfortably.
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 7000;

    const worklet = new AudioWorkletNode(ctx, "pcm-downsampler", {
      processorOptions: {
        inputSampleRate: ctx.sampleRate,
        outputSampleRate: token.sampleRate,
        chunkDurationMs: 150,
      },
    });
    workletNodeRef.current = worklet;

    source.connect(lowpass);
    lowpass.connect(worklet);
    // AudioWorklet needs to be in the graph even though we don't play
    // audio back — route through a silent gain to the destination.
    const silent = ctx.createGain();
    silent.gain.value = 0;
    worklet.connect(silent).connect(ctx.destination);

    worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      try {
        transcriber.sendAudio(e.data);
      } catch {
        /* ignore transient: closed socket during teardown */
      }
    };
  };

  const stop = async () => {
    if (stage !== "live") return;
    setStage("stopping");
    const meetingId = meetingIdRef.current;
    const finals = finalizedRef.current;
    const pending = partial;
    const allTurns = pending ? [...finals, pending] : finals;
    const durationSeconds = (Date.now() - startedAtRef.current) / 1000;
    await teardown();

    if (!meetingId) {
      setStage("error");
      setError("Missing meeting id — nothing to persist.");
      return;
    }

    try {
      const res = await fetch("/api/transcribe/stream/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId,
          text: allTurns.map((t) => t.text).join("\n"),
          utterances: allTurns.map((t) => ({
            speaker: t.speaker,
            text: t.text,
            start: t.startMs,
            end: t.endMs,
            confidence: 1,
          })),
          durationSeconds,
        }),
      });
      if (!res.ok) {
        const msg = await res
          .json()
          .then((d) => d.error ?? res.statusText)
          .catch(() => res.statusText);
        throw new Error(msg);
      }
      router.push(`/meetings/${meetingId}`);
    } catch (err) {
      setError(`Finalize failed: ${(err as Error).message}`);
      setStage("error");
    }
  };

  const canStart = stage === "idle" || stage === "error";
  const canStop = stage === "live";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {canStart ? (
          <button
            type="button"
            onClick={start}
            className="rounded-md border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-900/60"
          >
            Start live session
          </button>
        ) : null}
        {canStop ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-md border border-red-700 bg-red-900/40 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-900/60"
          >
            Stop and save
          </button>
        ) : null}
        {stage === "starting" ? (
          <span className="text-xs text-neutral-400">Starting session…</span>
        ) : null}
        {stage === "stopping" ? (
          <span className="text-xs text-neutral-400">Saving transcript…</span>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-300"
        >
          {error}
        </div>
      ) : null}

      <LiveTranscriptView
        finalizedTurns={finalizedTurns}
        partial={partial}
        connected={stage === "live"}
        elapsedSeconds={elapsed}
      />
    </div>
  );
}
