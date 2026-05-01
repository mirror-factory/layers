import { notFound } from "next/navigation";
import { TopBar } from "@/components/top-bar";
import { MeetingCostPanel } from "@/components/meeting-cost-panel";
import { MeetingChat } from "@/components/meeting-chat";
import { MeetingNotesPushPanel } from "@/components/meeting-notes-push-panel";
import { MeetingDetailPollerWrapper } from "./poller-wrapper";
import { getMeetingsStore } from "@/lib/meetings/store";
import { AudioWaveRibbon } from "@/components/audio-wave-ribbon";
import {
  SessionCaptureCard,
  SessionIntelligenceCanvas,
  type SessionActionRow,
  type SessionTranscriptRow,
} from "@/components/session-workspace";
import { formatMeetingActionItem } from "@/lib/meeting-notes";
import type { Meeting } from "@/lib/meetings/types";

export const dynamic = "force-dynamic";

interface MeetingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MeetingDetailPage({
  params,
}: MeetingDetailPageProps) {
  const { id } = await params;

  const store = await getMeetingsStore();
  const meeting = await store.get(id);

  if (!meeting) notFound();

  const isCompleted = meeting.status === "completed";

  return (
    <div className="paper-calm-page recorder-page session-workspace-page min-h-screen-safe flex flex-col">
      <TopBar
        title={meeting.title ?? "Meeting Detail"}
        showBack
      />

      <main className="meeting-detail-main session-detail-main flex-1 px-4 pb-safe py-6 mx-auto w-full space-y-6">
        {!isCompleted && meeting.status !== "error" && (
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="meeting-detail-header flex items-center justify-between rounded-xl border border-[var(--border-card)] bg-[var(--surface-panel)] p-4">
              <div>
                <p className="signal-eyebrow">Meeting note</p>
                <h1 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                  {meeting.title ?? "Untitled recording"}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(meeting.createdAt).toLocaleString()}
                  </span>
                  {meeting.durationSeconds != null && (
                    <span className="text-xs text-[var(--text-muted)]">
                      {Math.round(meeting.durationSeconds / 60)} min
                    </span>
                  )}
                </div>
              </div>
              <StatusChip status={meeting.status} />
            </div>

            <MeetingDetailPollerWrapper
              meetingId={meeting.id}
              initialStatus={meeting.status}
            />
          </div>
        )}

        {meeting.status === "error" && (
          <div className="mx-auto max-w-5xl">
            <div className="meeting-detail-header mb-4 flex items-center justify-between rounded-xl border border-[var(--border-card)] bg-[var(--surface-panel)] p-4">
              <div>
                <p className="signal-eyebrow">Meeting note</p>
                <h1 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                  {meeting.title ?? "Untitled recording"}
                </h1>
              </div>
              <StatusChip status={meeting.status} />
            </div>
            <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-signal-live/20">
              <div className="text-sm text-signal-live font-medium">
                Processing Error
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {meeting.error ?? "An unknown error occurred."}
              </p>
            </div>
          </div>
        )}

        {isCompleted && (
          <CompletedMeetingWorkspace meeting={meeting} />
        )}
      </main>
    </div>
  );
}

type CompletedMeeting = Meeting;
type CompletedActionItem = NonNullable<CompletedMeeting["summary"]>["actionItems"][number];

interface CompletedSummaryViewModel {
  title: string | null;
  summary: string | null;
  keyPoints: string[];
  actionItems: CompletedActionItem[];
  decisions: string[];
  participants: string[];
}

function CompletedMeetingWorkspace({ meeting }: { meeting: CompletedMeeting }) {
  const meetingDate = new Date(meeting.createdAt);
  const summary = normalizeCompletedSummary(meeting.summary);
  const summaryText =
    summary.summary ??
    "Layers did not generate a summary for this recording yet.";
  const transcriptRows = buildCompletedTranscriptRows(meeting.utterances);
  const actionRows = buildCompletedActions(summary.actionItems);
  const keyPoints = summary.keyPoints;
  const subtitle =
    summary.participants.length
      ? summary.participants.join(", ")
      : keyPoints[0] ?? "Recorded session";
  const stats = {
    segments: meeting.utterances.length,
    words: countMeetingWords(
      meeting.text ?? meeting.utterances.map((utterance) => utterance.text).join(" "),
    ),
    points: keyPoints.length,
    actions: actionRows.length,
  };

  return (
    <>
      <div className="session-detail-workspace">
        <SessionCaptureCard
          date={meetingDate}
          durationLabel={formatMeetingDuration(meeting.durationSeconds)}
          statusLabel="Summary ready"
          badgeLabel="DONE"
          badgeTone="done"
          title={meeting.title ?? summary.title ?? "Untitled recording"}
          subtitle={subtitle}
          calendarConnected={false}
          stats={stats}
          waveSlot={
            <AudioWaveRibbon
              active={false}
              audioLevel={0.18}
              height={118}
              sensitivity={1.05}
              motion={1.1}
              texture="clean"
              className="w-full"
            />
          }
          controlSlot={
            <div className="session-detail-control-stack">
              <div className="session-detail-status">
                <StatusChip status={meeting.status} />
              </div>
              <MeetingNotesPushPanel meetingId={meeting.id} variant="compact" />
            </div>
          }
        />

        <SessionIntelligenceCanvas
          mode="summary"
          summaryText={summaryText}
          updatedLabel="Ready now"
          transcriptRows={transcriptRows}
          keyPoints={keyPoints}
          actions={actionRows}
          decisions={summary.decisions}
          stats={stats}
          askPanel={
            <MeetingChat
              key="ask-panel"
              meetingId={meeting.id}
              variant="workspace"
            />
          }
          footerStatus="Summary - transcript ready"
        />
      </div>

      <div className="session-detail-utilities">
        <MeetingCostPanel costBreakdown={meeting.costBreakdown} />
      </div>
    </>
  );
}

function normalizeCompletedSummary(
  summary: CompletedMeeting["summary"],
): CompletedSummaryViewModel {
  if (!summary || typeof summary !== "object") {
    return {
      title: null,
      summary: null,
      keyPoints: [],
      actionItems: [],
      decisions: [],
      participants: [],
    };
  }

  const raw = summary as Record<string, unknown>;

  return {
    title: normalizeOptionalString(raw.title),
    summary: normalizeOptionalString(raw.summary),
    keyPoints: normalizeStringArray(raw.keyPoints),
    actionItems: normalizeActionItems(raw.actionItems),
    decisions: normalizeStringArray(raw.decisions),
    participants: normalizeStringArray(raw.participants),
  };
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

function normalizeActionItems(value: unknown): CompletedActionItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const raw = item as Record<string, unknown>;
    if (typeof raw.task !== "string" || raw.task.trim().length === 0) {
      return [];
    }

    return [
      {
        task: raw.task,
        assignee: typeof raw.assignee === "string" ? raw.assignee : null,
        dueDate: typeof raw.dueDate === "string" ? raw.dueDate : null,
      },
    ];
  });
}

function buildCompletedTranscriptRows(
  utterances: CompletedMeeting["utterances"],
): SessionTranscriptRow[] {
  return utterances.slice(0, 12).map((utterance, index) => ({
    id: `${utterance.start}-${index}`,
    timestamp: formatMeetingTimestamp(utterance.start),
    text: utterance.text,
    tone:
      index % 5 === 3
        ? ("orange" as const)
        : index % 3 === 2
          ? ("cyan" as const)
          : ("blue" as const),
  }));
}

function formatMeetingTimestamp(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function countMeetingWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function buildCompletedActions(
  actionItems: CompletedActionItem[],
): SessionActionRow[] {
  const priorities: Array<SessionActionRow["priority"]> = ["High", "Med", "Low"];
  return actionItems.map((action, index) => ({
    id: `${action.task}-${index}`,
    text: formatMeetingActionItem(action),
    due: action.dueDate
      ? new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
        }).format(new Date(action.dueDate))
      : null,
    priority: priorities[index % priorities.length],
  }));
}

function formatMeetingDuration(seconds: number | null): string {
  const safeSeconds = Math.max(0, seconds ?? 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder
    .toString()
    .padStart(2, "0")}`;
}

function StatusChip({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    completed: { bg: "bg-signal-success/10", text: "text-signal-success" },
    processing: { bg: "bg-layers-mint/10", text: "text-layers-mint" },
    queued: { bg: "bg-signal-warning/10", text: "text-signal-warning" },
    error: { bg: "bg-signal-live/10", text: "text-signal-live" },
  };
  const c = config[status] ?? config.processing;

  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${c.bg} ${c.text}`}
    >
      {status}
    </span>
  );
}
