"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { MessageSquare, X } from "lucide-react";
import { ChatInput } from "@/components/chat-input";
import { ChatMessage } from "@/components/chat-message";
import { MeetingChat } from "@/components/meeting-chat";

/**
 * FloatingAsk
 *
 * Always-available "Ask" pill anchored bottom-right of authenticated app
 * pages. Click (or Cmd/Ctrl+K) expands a slide-up sheet:
 *   - On `/meetings/[id]` → scoped MeetingChat (full citations).
 *   - Anywhere else → library-wide chat (mirrors current /chat).
 *
 * Positioned to clear the bottom-anchored mobile-primary-nav and the iOS
 * safe-area inset. Hidden on routes where the inline chat surface is the
 * primary content (so it does not double up): /chat, /ask, public
 * marketing/legal routes, auth pages.
 */

const PUBLIC_ROUTE_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/auth",
  "/oauth",
  "/landing",
  "/changelog",
  "/pricing",
  "/privacy",
  "/terms",
  "/account-deletion",
  "/download",
  "/docs",
];

/**
 * The library-wide chat surface (/chat) and the dedicated Ask page (/ask)
 * already render the same chat experience inline. Hide the pill there so
 * we don't ship two of the same UI.
 */
const REDUNDANT_CHAT_ROUTE_PREFIXES = ["/chat", "/ask"];

const MEETING_DETAIL_PATTERN = /^\/meetings\/([^/?#]+)/;

interface RouteContext {
  enabled: boolean;
  meetingId: string | null;
  isLanding: boolean;
}

function deriveRouteContext(pathname: string | null): RouteContext {
  if (!pathname) {
    return { enabled: false, meetingId: null, isLanding: true };
  }

  if (pathname === "/") {
    return { enabled: false, meetingId: null, isLanding: true };
  }

  if (PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return { enabled: false, meetingId: null, isLanding: false };
  }

  if (
    REDUNDANT_CHAT_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return { enabled: false, meetingId: null, isLanding: false };
  }

  const match = pathname.match(MEETING_DETAIL_PATTERN);
  return {
    enabled: true,
    meetingId: match?.[1] ?? null,
    isLanding: false,
  };
}

/**
 * Routes where bottom-anchored UI (mobile-primary-nav, recording bar)
 * already lives at the same edge. On these surfaces we lift the pill so
 * the two don't collide on small screens.
 */
function shouldLiftAboveBottomNav(pathname: string): boolean {
  return (
    pathname === "/meetings" ||
    pathname.startsWith("/record")
  );
}

export function FloatingAsk() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLButtonElement | null>(null);

  const route = useMemo(() => deriveRouteContext(pathname), [pathname]);

  const close = useCallback(() => setOpen(false), []);
  const openSheet = useCallback(() => setOpen(true), []);

  // Cmd/Ctrl+K toggle, ESC close. Registered globally so it works from any
  // focused element on any authenticated page.
  useEffect(() => {
    if (!route.enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      const isModKey = event.metaKey || event.ctrlKey;
      if (isModKey && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (event.key === "Escape") {
        setOpen((prev) => (prev ? false : prev));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [route.enabled]);

  // Lock body scroll while sheet is open (matches existing modal patterns).
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Return focus to the pill when the sheet closes for keyboard users.
  useEffect(() => {
    if (!open) {
      pillRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  if (!route.enabled) return null;

  const liftAboveNav = pathname ? shouldLiftAboveBottomNav(pathname) : false;

  return (
    <>
      <button
        ref={pillRef}
        type="button"
        onClick={openSheet}
        aria-label="Open Ask (Cmd+K)"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="floating-ask-pill"
        data-state={open ? "open" : "closed"}
        className={[
          "floating-ask-pill",
          liftAboveNav ? "floating-ask-pill--above-nav" : "",
          open ? "floating-ask-pill--hidden" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <MessageSquare size={16} aria-hidden />
        <span className="floating-ask-pill-label">Ask</span>
        <kbd className="floating-ask-pill-kbd" aria-hidden>
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="floating-ask-overlay"
          role="presentation"
          onClick={close}
          data-testid="floating-ask-overlay"
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={
              route.meetingId
                ? "Ask about this meeting"
                : "Ask across your meetings"
            }
            className="floating-ask-sheet"
            onClick={(event) => event.stopPropagation()}
            data-testid="floating-ask-sheet"
          >
            <header className="floating-ask-sheet-header">
              <div className="flex items-center gap-2">
                <MessageSquare
                  size={16}
                  className="text-layers-mint"
                  aria-hidden
                />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  {route.meetingId
                    ? "Ask about this meeting"
                    : "Ask across your meetings"}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close Ask"
                className="floating-ask-close"
              >
                <X size={16} aria-hidden />
              </button>
            </header>

            <div className="floating-ask-sheet-body">
              {route.meetingId ? (
                <MeetingChat meetingId={route.meetingId} variant="default" />
              ) : (
                <LibraryAskPanel />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Library-wide chat panel — mirrors the inline /chat experience but trimmed
 * for the sheet. Uses the default useChat() transport (same `/api/chat`
 * route) without a meetingId, which is exactly what /chat does today.
 */
function LibraryAskPanel() {
  const { messages, sendMessage, status } = useChat();
  const isLoading = status === "streaming" || status === "submitted";
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const suggestions = [
    "Find decisions",
    "Draft follow-up",
    "Summarize this week",
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        className="signal-panel min-h-0 flex-1 overflow-y-auto rounded-lg p-4"
        data-testid="floating-ask-messages"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-layers-mint/25 bg-layers-mint/10 text-layers-mint-soft">
              <MessageSquare size={16} aria-hidden />
            </div>
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Ask anything from your meeting library.
            </p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--text-muted)]">
              Pull summaries, decisions, owners, or next steps.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage({ text: prompt })}
                  className="signal-chip signal-chip-neutral transition-colors hover:border-layers-mint/35 hover:text-[var(--text-primary)]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}
      </div>

      <div className="pt-3">
        <ChatInput
          onSend={(text) => sendMessage({ text })}
          disabled={isLoading}
          placeholder="Ask across your meetings..."
        />
      </div>
    </div>
  );
}
