"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import {
  LIBRARY_EMPTY_STATE_SAMPLE,
  LIBRARY_PROMPTS,
} from "@/lib/chat/contextual-prompts";

export default function ChatPage() {
  const { messages, sendMessage, status } = useChat();
  const isLoading = status === "streaming" || status === "submitted";
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <div className="paper-calm-page min-h-screen-safe flex flex-col">
      <TopBar title="Chat" showBack />

      <main className="mx-auto flex w-full max-w-3xl flex-1 overflow-hidden px-4 py-4">
        <div
          ref={scrollRef}
          className="signal-panel min-h-0 flex-1 overflow-y-auto rounded-lg p-4"
        >
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-layers-mint/25 bg-layers-mint/10 text-layers-mint-soft">
                <MessageSquare size={18} />
              </div>
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                Ask anything from your meeting library.
              </p>
              <p className="mt-2 max-w-sm text-xs leading-5 text-[var(--text-muted)]">
                Try:{" "}
                <button
                  type="button"
                  onClick={() => sendMessage({ text: LIBRARY_EMPTY_STATE_SAMPLE })}
                  disabled={isLoading}
                  className="italic text-[var(--text-secondary)] underline decoration-dotted underline-offset-4 transition-colors hover:text-layers-mint focus:outline-none focus:ring-2 focus:ring-layers-mint/40 disabled:opacity-50"
                >
                  &lsquo;{LIBRARY_EMPTY_STATE_SAMPLE}&rsquo;
                </button>
              </p>
              <div
                className="mt-5 flex flex-wrap justify-center gap-2"
                aria-label="Suggested prompts"
              >
                {LIBRARY_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage({ text: prompt })}
                    disabled={isLoading}
                    className="signal-chip signal-chip-neutral cursor-pointer transition-colors hover:border-layers-mint/50 hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-layers-mint/40 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <ChatMessage key={m.id} message={m} />)
          )}
        </div>
      </main>

      <div className="mx-auto w-full max-w-3xl px-4">
        <div className="mx-auto max-w-3xl">
          <ChatInput
            onSend={(text) => {
              sendMessage({ text });
            }}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
