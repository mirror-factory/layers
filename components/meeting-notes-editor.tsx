"use client";

/**
 * MeetingNotesEditor (PROD-465).
 *
 * User-authored free-form notes for a meeting. Sits in the "Notes" tab
 * inside SessionIntelligenceCanvas. Auto-saves to /api/meetings/[id]
 * with a 1-second debounce after each keystroke.
 *
 * Design intent (per docs/COMPETITIVE_UX.md §5 #5): the user is the
 * author, the AI summary is the enhanced view. The Notes tab is the
 * user's space; flipping tabs to Summary reveals what the AI made of
 * the same conversation.
 *
 * Future (deferred): in-call live editing with optimistic sync to the
 * recording-draft pipeline (lib/recording/local-draft.ts).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Check, NotebookPen } from "lucide-react";

interface MeetingNotesEditorProps {
  meetingId: string;
  initialValue: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 1000;
const SAVED_HINT_DECAY_MS = 1800;
const MAX_NOTES_LENGTH = 50_000;

export function MeetingNotesEditor({
  meetingId,
  initialValue,
}: MeetingNotesEditorProps) {
  const [value, setValue] = useState<string>(initialValue ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedRef = useRef<string>(initialValue ?? "");
  const savedHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const persist = useCallback(
    async (next: string) => {
      // Avoid POSTing the same value twice in a row — e.g. when the user
      // pauses typing without changing anything.
      if (next === lastPersistedRef.current) return;
      setSaveState("saving");
      try {
        const res = await fetch(`/api/meetings/${meetingId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userNotes: next.length === 0 ? null : next }),
        });
        if (!res.ok) throw new Error(`save failed: status ${res.status}`);
        lastPersistedRef.current = next;
        setSaveState("saved");
        if (savedHintTimeoutRef.current) {
          clearTimeout(savedHintTimeoutRef.current);
        }
        savedHintTimeoutRef.current = setTimeout(() => {
          setSaveState("idle");
          savedHintTimeoutRef.current = null;
        }, SAVED_HINT_DECAY_MS);
      } catch {
        setSaveState("error");
      }
    },
    [meetingId],
  );

  const scheduleSave = useCallback(
    (next: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void persist(next);
        debounceRef.current = null;
      }, SAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedHintTimeoutRef.current) clearTimeout(savedHintTimeoutRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (next: string) => {
      setValue(next);
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const handleBlur = useCallback(() => {
    // Flush any pending debounce when the user leaves the editor.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      void persist(value);
    }
  }, [persist, value]);

  return (
    <article className="session-panel session-notes-panel">
      <header>
        <div>
          <NotebookPen size={18} aria-hidden="true" />
          <h3>Your notes</h3>
        </div>
        <SaveStatePill state={saveState} />
      </header>
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="What you want to remember about this meeting. The AI summary lives one tab over."
        maxLength={MAX_NOTES_LENGTH}
        spellCheck
        className="session-notes-editor"
        aria-label="Your notes for this meeting"
      />
    </article>
  );
}

function SaveStatePill({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="session-notes-save-pill is-saving">
        <Loader2 size={12} aria-hidden="true" /> Saving
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="session-notes-save-pill is-saved">
        <Check size={12} aria-hidden="true" /> Saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="session-notes-save-pill is-error">
        Save failed — keep typing to retry
      </span>
    );
  }
  return null;
}
