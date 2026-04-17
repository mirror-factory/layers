"use client";

/**
 * Live transcript view used during an active streaming session.
 *
 * Renders finalized turns above and the current in-flight partial at
 * the bottom, matching the Granola-style "gray = AI guess / black =
 * settled" metaphor (here: emerald accent for the live turn, neutral
 * for finalized ones).
 */

import type { LiveTurn } from "./live-recorder";

interface Props {
  finalizedTurns: LiveTurn[];
  partial: LiveTurn | null;
  connected: boolean;
  elapsedSeconds: number;
}

export function LiveTranscriptView({
  finalizedTurns,
  partial,
  connected,
  elapsedSeconds,
}: Props) {
  const hasContent = finalizedTurns.length > 0 || partial;
  return (
    <section
      aria-label="Live transcript"
      aria-live="polite"
      className="rounded-lg border border-neutral-800 bg-neutral-900/40"
    >
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-2 text-xs">
        <div className="flex items-center gap-2 text-neutral-400">
          <span
            aria-hidden
            className={`inline-block h-2 w-2 rounded-full ${
              connected ? "animate-pulse bg-emerald-400" : "bg-neutral-600"
            }`}
          />
          {connected ? "Live" : "Connecting…"}
        </div>
        <span className="font-mono text-neutral-500">
          {formatElapsed(elapsedSeconds)}
        </span>
      </header>

      <div className="max-h-[50dvh] min-h-[12rem] overflow-y-auto px-4 py-3">
        {!hasContent ? (
          <p className="text-sm text-neutral-500">
            Waiting for speech… say something into your microphone.
          </p>
        ) : (
          <ul className="space-y-3">
            {finalizedTurns.map((t) => (
              <TurnRow key={t.id} turn={t} finalized />
            ))}
            {partial ? <TurnRow turn={partial} finalized={false} /> : null}
          </ul>
        )}
      </div>
    </section>
  );
}

function TurnRow({ turn, finalized }: { turn: LiveTurn; finalized: boolean }) {
  const borderCls = finalized
    ? "border-neutral-800 bg-neutral-900/60"
    : "border-emerald-800/60 bg-emerald-950/20";
  const textCls = finalized ? "text-neutral-200" : "text-emerald-100";
  return (
    <li className={`rounded-md border ${borderCls} p-3`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
          {turn.speaker ? `Speaker ${turn.speaker}` : "Speaker"}
        </span>
        {finalized ? null : (
          <span className="text-[10px] uppercase tracking-wide text-emerald-300/80">
            live
          </span>
        )}
      </div>
      <p className={`mt-1 text-sm leading-relaxed ${textCls}`}>{turn.text}</p>
    </li>
  );
}

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const r = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${r}`;
}
