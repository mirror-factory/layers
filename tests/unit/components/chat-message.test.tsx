// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type { UIMessage } from "ai";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChatMessage } from "@/components/chat-message";

afterEach(() => {
  cleanup();
});

describe("chat-message component", () => {
  it("renders AI SDK reasoning parts without dropping the message", () => {
    const message = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        { type: "reasoning", text: "Checked the meeting transcript first." },
        { type: "text", text: "The next step is to send the recap." },
      ],
    } as unknown as UIMessage;

    render(<ChatMessage message={message} />);

    expect(screen.getByText("Reasoning")).toBeInTheDocument();
    expect(screen.getByText("Checked the meeting transcript first.")).toBeInTheDocument();
    expect(screen.getByText("The next step is to send the recap.")).toBeInTheDocument();
  });
});
