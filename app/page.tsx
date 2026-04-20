"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { LiveRecorder } from "@/components/live-recorder";
import { LiveTranscriptView } from "@/components/live-transcript-view";
import { WebGLShader } from "@/components/ui/web-gl-shader";

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
  const [isRecording, setIsRecording] = useState(false);

  const shaderIntensity = isRecording ? 0.7 : 0.25;

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
      if (!isRecording && (newTurns.length > 0 || newPartial)) {
        setIsRecording(true);
      }
    },
    [isRecording],
  );

  const handleSessionEnd = useCallback(
    (meetingId: string) => {
      setIsRecording(false);
      setTimeout(() => {
        router.push(`/meetings/${meetingId}`);
      }, 1500);
    },
    [router],
  );

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* WebGL Shader Background */}
      <WebGLShader intensity={shaderIntensity} speed={isRecording ? 1.4 : 0.8} />

      {/* Content layer */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <TopBar title="Layer One" />

        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
          {/* Recorder - centered hero */}
          <div className="flex flex-col items-center justify-center flex-1 min-h-[40vh]">
            <LiveRecorder
              onTranscriptUpdate={handleTranscriptUpdate}
              onSessionEnd={handleSessionEnd}
            />
          </div>

          {/* Live transcript area */}
          {(turns.length > 0 || partial) && (
            <div className="w-full max-w-2xl mx-auto mb-8 glass-panel rounded-2xl p-5 max-h-[40vh] overflow-y-auto">
              <LiveTranscriptView turns={turns} partial={partial} />
            </div>
          )}

          {/* Recent Meetings - bottom tray */}
          <section className="w-full max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-widest">
                Recent
              </h2>
              <Link
                href="/meetings"
                className="text-xs text-[var(--accent-mint)] hover:text-[#5eead4] transition-colors duration-200"
              >
                View all
              </Link>
            </div>

            {recentMeetings.length === 0 ? (
              <div className="glass-card rounded-xl p-5 text-center">
                <p className="text-sm text-[var(--text-muted)]">
                  No meetings yet. Tap the mic to start.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentMeetings.map((m) => (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className="flex items-center justify-between glass-card rounded-lg px-4 py-3 transition-all duration-200 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-[var(--text-primary)] truncate group-hover:text-white transition-colors duration-200">
                        {m.title ?? "Untitled recording"}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {new Date(m.createdAt).toLocaleDateString()}
                        {m.durationSeconds
                          ? ` \u00b7 ${Math.round(m.durationSeconds / 60)} min`
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
