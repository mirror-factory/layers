import type { TranscribeUtterance } from "@/lib/assemblyai/types";
import type { MeetingSummary } from "@/lib/assemblyai/schema";
import { Download } from "lucide-react";

interface TranscriptViewProps {
  utterances: TranscribeUtterance[];
  summary: MeetingSummary | null;
  meetingId: string;
}

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptView({ utterances, summary, meetingId }: TranscriptViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Transcript */}
      <div className="bg-[var(--bg-card)] rounded-xl flex flex-col" style={{ maxHeight: "70vh" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Transcript
          </h3>
          <div className="flex items-center gap-1">
            <a
              href={`/api/meetings/${meetingId}/export?format=md`}
              className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              <Download size={12} />
              MD
            </a>
            <a
              href={`/api/meetings/${meetingId}/export?format=pdf`}
              className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              <Download size={12} />
              PDF
            </a>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5" style={{ scrollbarWidth: "none" }}>
          {utterances.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-4">No utterances available.</p>
          ) : (
            <div className="space-y-3">
              {utterances.map((u, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="shrink-0 text-[10px] text-[var(--text-muted)] tabular-nums pt-0.5 w-8 text-right">
                    {formatTime(u.start)}
                  </span>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed flex-1">
                    {u.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-[var(--bg-card)] rounded-xl flex flex-col" style={{ maxHeight: "70vh" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Summary
          </h3>
          <a
            href={`/api/meetings/${meetingId}/export?format=md`}
            className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            <Download size={12} />
            Export
          </a>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5" style={{ scrollbarWidth: "none" }}>
          {!summary ? (
            <p className="text-sm text-[var(--text-muted)] py-4">No summary available.</p>
          ) : (
            <div className="space-y-5">
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                {summary.summary}
              </p>

              {summary.keyPoints.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                    Key Points
                  </h4>
                  <ul className="space-y-1.5">
                    {summary.keyPoints.map((kp, i) => (
                      <li key={i} className="text-sm text-[var(--text-secondary)] flex gap-2">
                        <span className="text-[#14b8a6] shrink-0">·</span>
                        {kp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.actionItems.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                    Action Items
                  </h4>
                  <ul className="space-y-1.5">
                    {summary.actionItems.map((ai, i) => (
                      <li key={i} className="text-sm text-[var(--text-secondary)]">
                        {ai.assignee && <span className="text-[#14b8a6]">{ai.assignee}: </span>}
                        {ai.task}
                        {ai.dueDate && <span className="text-xs text-[var(--text-muted)] ml-1">(due {ai.dueDate})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.decisions.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                    Decisions
                  </h4>
                  <ul className="space-y-1.5">
                    {summary.decisions.map((d, i) => (
                      <li key={i} className="text-sm text-[var(--text-secondary)] flex gap-2">
                        <span className="text-[#14b8a6] shrink-0">·</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.participants.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                    Participants
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.participants.map((p, i) => (
                      <span key={i} className="text-xs bg-[var(--bg-card-hover)] text-[var(--text-secondary)] px-2 py-0.5 rounded">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
