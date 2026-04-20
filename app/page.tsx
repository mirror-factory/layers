"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { LiveRecorder } from "@/components/live-recorder";
import { LiveTranscriptView } from "@/components/live-transcript-view";
import { useEffect } from "react";

interface Turn {
  speaker: string | null;
  text: string;
  start: number;
  end: number;
  confidence: number;
  final: boolean;
}

interface MeetingItem {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  durationSeconds: number | null;
}

export default function HomePage() {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [partial, setPartial] = useState("");
  const [recentMeetings, setRecentMeetings] = useState<MeetingItem[]>([]);

  useEffect(() => {
    fetch("/api/meetings?limit=5")
      .then((r) => r.json())
      .then((data) => setRecentMeetings(data.items ?? data ?? []))
      .catch(() => {});
  }, []);

  const handleTranscriptUpdate = useCallback(
    (newTurns: Turn[], newPartial: string) => {
      setTurns([...newTurns]);
      setPartial(newPartial);
    },
    [],
  );

  const handleSessionEnd = useCallback(
    (meetingId: string) => {
      router.push(`/meetings/${meetingId}`);
    },
    [router],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title="Layer One" />

      <main className="flex-1 px-4 pt-6 pb-8 max-w-3xl mx-auto w-full">
        {/* Live Recorder — front and center */}
        <div className="mb-6">
          <LiveRecorder
            onTranscriptUpdate={handleTranscriptUpdate}
            onSessionEnd={handleSessionEnd}
          />
        </div>

        {/* Live transcript area */}
        {(turns.length > 0 || partial) && (
          <div className="mb-8 bg-[#171717] rounded-xl p-4 max-h-[50vh] overflow-y-auto">
            <LiveTranscriptView turns={turns} partial={partial} />
          </div>
        )}

        {/* Recent Meetings — below the fold */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#737373] uppercase tracking-wider">
              Recent Meetings
            </h2>
            <Link
              href="/meetings"
              className="text-xs text-[#14b8a6] hover:underline"
            >
              View all
            </Link>
          </div>

          {recentMeetings.length === 0 ? (
            <div className="bg-[#171717] rounded-xl p-6 text-center">
              <p className="text-sm text-[#525252]">
                No meetings yet. Tap the mic to start.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentMeetings.map((m) => (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className="flex items-center justify-between bg-[#171717] hover:bg-[#262626] rounded-lg px-4 py-3 transition-colors duration-200"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-[#d4d4d4] truncate">
                      {m.title ?? "Untitled recording"}
                    </div>
                    <div className="text-xs text-[#525252] mt-0.5">
                      {new Date(m.createdAt).toLocaleDateString()}
                      {m.durationSeconds
                        ? ` · ${Math.round(m.durationSeconds / 60)} min`
                        : ""}
                    </div>
                  </div>
                  <StatusChip status={m.status} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    completed: { bg: "bg-[#22c55e]/10", text: "text-[#22c55e]" },
    processing: { bg: "bg-[#14b8a6]/10", text: "text-[#14b8a6]" },
    queued: { bg: "bg-[#eab308]/10", text: "text-[#eab308]" },
    error: { bg: "bg-[#ef4444]/10", text: "text-[#ef4444]" },
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
