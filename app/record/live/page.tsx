"use client";

/**
 * /record/live — AssemblyAI Universal-3 Pro streaming (`u3-rt-pro`).
 *
 * Browser mic only for V1 (no system audio). The desktop Tauri shell
 * will add system-audio capture in a later PR.
 */

import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { LiveRecorder } from "@/components/live-recorder";

export default function RecordLivePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 px-4 pb-20 md:px-6">
      <TopBar title="Live Recording" />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col space-y-6">
        <div className="flex items-center gap-3 text-xs">
          <p className="flex-1 text-xs text-neutral-500">
            AssemblyAI Universal-3 Pro streaming over WebSocket. Finalized
            turns stream in as you speak; partial text updates live.
            Browser mic only — Tauri shell will add system audio.
          </p>
          <Link
            href="/record"
            className="min-h-[44px] flex items-center text-neutral-500 hover:text-neutral-300"
          >
            Batch mode
          </Link>
          <Link
            href="/meetings"
            className="min-h-[44px] flex items-center text-neutral-500 hover:text-neutral-300"
          >
            All meetings
          </Link>
        </div>

        <div className="flex-1">
          <LiveRecorder />
        </div>
      </div>
    </div>
  );
}
