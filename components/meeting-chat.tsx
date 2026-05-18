"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  Mail,
  MessageSquare,
  Users,
  type LucideIcon,
} from "lucide-react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { ChatInput } from "@/components/chat-input";
import { ChatMessage } from "@/components/chat-message";
import { useStickToBottom } from "@/lib/hooks/use-stick-to-bottom";
import {
  MEETING_PROMPTS,
  interpolateParticipant,
} from "@/lib/chat/contextual-prompts";

interface MeetingChatProps {
  meetingId: string;
  variant?: "default" | "workspace";
  onCitationClick?: (segmentNumber: number) => void;
  /**
   * Name of the primary non-self participant. When provided, the
   * "Draft a follow-up to {participant}" chip interpolates this value.
   */
  participantName?: string | null;
}

/**
 * Icon paired with each meeting-scoped prompt. Kept in MEETING_PROMPTS order
 * so the icon-chip rendering pattern continues to read left-to-right
 * meaningfully. PROD-462: the prior 5 generic templates (Sales / Interview /
 * Standup / Follow-up / Intake) are migrated to Recipes in PROD-463.
 */
const MEETING_PROMPT_ICONS: readonly LucideIcon[] = [
  CheckCircle2, // "What did we decide?"
  Users, // "Owner and deadlines"
  Mail, // "Draft a follow-up to {participant}"
  AlertTriangle, // "Risks I should flag"
] as const;

export function MeetingChat({
  meetingId,
  variant = "default",
  onCitationClick,
  participantName,
}: MeetingChatProps) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { meetingId },
      }),
    [meetingId],
  );
  const {
    messages,
    sendMessage,
    status,
    error,
    clearError,
    regenerate,
  } = useChat({
    id: `meeting-${meetingId}`,
    transport,
  });
  const isLoading = status === "streaming" || status === "submitted";

  // Key auto-scroll on message count, not streaming chunks. Streaming updates
  // (status === "streaming") still nudge sticky users via ResizeObserver.
  const { scrollRef, hasNewContent, isAtBottom, scrollToBottom, onScroll } =
    useStickToBottom(messages.length);

  const promptChips = useMemo(
    () =>
      MEETING_PROMPTS.map((prompt, index) => ({
        prompt: interpolateParticipant(prompt, participantName),
        icon: MEETING_PROMPT_ICONS[index] ?? MessageSquare,
      })),
    [participantName],
  );

  function sendPrompt(prompt: string) {
    if (isLoading) return;
    clearError();
    void sendMessage({ text: prompt });
  }

  function retryLastMessage() {
    if (isLoading) return;
    clearError();
    void regenerate();
  }

  const isWorkspace = variant === "workspace";

  return (
    <section
      className={
        isWorkspace
          ? "session-panel session-ask-preview session-meeting-chat"
          : "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)]"
      }
      aria-labelledby="meeting-chat-heading"
    >
      <div
        className={
          isWorkspace
            ? "session-meeting-chat-header"
            : "border-b border-[var(--border-subtle)] p-4"
        }
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-layers-mint" aria-hidden />
          <h3
            id="meeting-chat-heading"
            className="text-sm font-semibold text-[var(--text-primary)]"
          >
            {isWorkspace ? "Ask Layers" : "Ask about this meeting"}
          </h3>
          {isWorkspace && (
            <h2 className="sr-only">Ask about this meeting</h2>
          )}
        </div>
        <div
          className={
            isWorkspace
              ? "session-prompt-chips"
              : "mt-3 flex flex-wrap gap-2"
          }
          aria-label="Suggested prompts"
        >
          {promptChips.map(({ prompt, icon: Icon }) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendPrompt(prompt)}
              disabled={isLoading}
              className={
                isWorkspace
                  ? "session-prompt-button"
                  : "inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border-card)] bg-[var(--bg-secondary)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-layers-mint/50 hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-layers-mint/40 disabled:opacity-50"
              }
            >
              {!isWorkspace && <Icon size={14} aria-hidden />}
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className={
            isWorkspace
              ? "session-meeting-chat-messages"
              : "flex-1 min-h-0 overflow-y-auto p-4"
          }
          data-testid="meeting-chat-messages"
        >
          {error && (
            <div
              className="mb-4 rounded-lg border border-signal-live/25 bg-signal-live/10 p-3"
              role="status"
              aria-live="polite"
            >
              <div className="text-xs font-medium text-signal-live">
                The assistant could not answer.
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                Check the selected model/provider settings, then retry the last message.
              </p>
              <button
                type="button"
                onClick={retryLastMessage}
                disabled={isLoading || messages.length === 0}
                className="mt-3 min-h-8 rounded-md border border-signal-live/25 px-3 text-xs font-medium text-signal-live transition-colors hover:bg-signal-live/10 disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="flex min-h-[180px] items-center justify-center text-center">
              <p className="max-w-sm text-sm text-[var(--text-muted)]">
                Ask for decisions, follow-ups, risks, or a structured template grounded in this transcript.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onCitationClick={onCitationClick}
              />
            ))
          )}
        </div>

        {hasNewContent && !isAtBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-layers-mint px-3 py-1.5 text-xs font-semibold text-layers-ink shadow-lg ring-1 ring-layers-mint/40 transition-transform hover:scale-[1.02]"
            aria-label="Jump to newest message"
          >
            <ArrowDown size={13} aria-hidden />
            New message
          </button>
        )}
      </div>

      <div
        className={isWorkspace ? "session-meeting-chat-input" : undefined}
        style={
          isWorkspace
            ? undefined
            : { paddingBottom: "env(safe-area-inset-bottom)" }
        }
      >
        <ChatInput
          onSend={(text) => {
            clearError();
            void sendMessage({ text });
          }}
          disabled={isLoading}
          placeholder="Ask about this transcript..."
        />
      </div>
    </section>
  );
}
