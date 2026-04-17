"use client";

/**
 * /record/live — AssemblyAI Universal-3 Pro streaming (`u3-rt-pro`).
 *
 * Browser mic only for V1 (no system audio). The desktop Tauri shell
 * will add system-audio capture in a later PR.
 */

import Link from "next/link";
import { LiveRecorder } from "@/components/live-recorder";

export default function RecordLivePage() {
  return (
    <div className="min-h-dvh bg-neutral-950 p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-200">
              Live recording
            </h1>
            <p className="text-xs text-neutral-500">
              AssemblyAI Universal-3 Pro streaming over WebSocket. Finalized
              turns stream in as you speak; partial text updates live.
              Browser mic only — Tauri shell will add system audio.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/record"
              className="text-neutral-500 hover:text-neutral-300"
            >
              Batch mode →
            </Link>
            <Link
              href="/meetings"
              className="text-neutral-500 hover:text-neutral-300"
            >
              All meetings
            </Link>
            <Link href="/" className="text-neutral-500 hover:text-neutral-300">
              ← Hub
            </Link>
          </div>
        </header>

        <LiveRecorder />
      </div>
    </div>
  );
}
