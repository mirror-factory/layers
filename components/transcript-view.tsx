"use client";

/**
 * Renders a completed transcript: speaker-segmented utterances + the
 * structured MeetingSummary sidebar.
 */

import type { MeetingSummary } from "@/lib/assemblyai/schema";
import type { TranscribeUtterance } from "@/lib/assemblyai/types";

interface Props {
  utterances: TranscribeUtterance[];
  text?: string;
  durationSeconds?: number;
  summary?: MeetingSummary;
}

export function TranscriptView({
  utterances,
  text,
  durationSeconds,
  summary,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_20rem]">
      <section aria-label="Transcript" className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-200">Transcript</h2>
          {typeof durationSeconds === "number" ? (
            <span className="text-xs text-neutral-500">
              {formatDuration(durationSeconds)}
            </span>
          ) : null}
        </header>
        {utterances.length > 0 ? (
          <ul className="space-y-3">
            {utterances.map((u, i) => (
              <li
                key={`${u.start}-${i}`}
                className="rounded-md border border-neutral-800 bg-neutral-900/50 p-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                    {u.speaker ? `Speaker ${u.speaker}` : "Speaker"}
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {formatTs(u.start)} – {formatTs(u.end)}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-neutral-200">
                  {u.text}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="whitespace-pre-wrap rounded-md border border-neutral-800 bg-neutral-900/50 p-3 text-sm leading-relaxed text-neutral-200">
            {text ?? "No transcript content."}
          </p>
        )}
      </section>

      <aside aria-label="Summary" className="space-y-4">
        <h2 className="text-sm font-semibold text-neutral-200">Summary</h2>
        {summary ? (
          <>
            <p className="text-sm leading-relaxed text-neutral-300">
              {summary.summary}
            </p>
            {summary.keyPoints.length > 0 ? (
              <SummarySection title="Key points" items={summary.keyPoints} />
            ) : null}
            {summary.decisions.length > 0 ? (
              <SummarySection title="Decisions" items={summary.decisions} />
            ) : null}
            {summary.actionItems.length > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Action items
                </h3>
                <ul className="space-y-2">
                  {summary.actionItems.map((a, i) => (
                    <li
                      key={i}
                      className="rounded-md border border-neutral-800 bg-neutral-900/50 p-2 text-xs text-neutral-300"
                    >
                      <div className="font-medium text-neutral-100">
                        {a.task}
                      </div>
                      <div className="mt-0.5 text-neutral-500">
                        {a.assignee ?? "unassigned"}
                        {a.dueDate ? ` · due ${a.dueDate}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {summary.participants.length > 0 ? (
              <SummarySection
                title="Participants"
                items={summary.participants}
              />
            ) : null}
          </>
        ) : (
          <p className="text-xs text-neutral-500">Summary unavailable.</p>
        )}
      </aside>
    </div>
  );
}

function SummarySection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {title}
      </h3>
      <ul className="list-disc space-y-1 pl-4 text-xs text-neutral-300">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function formatTs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}
