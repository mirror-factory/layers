import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("chat message reasoning support", () => {
  it("keeps a renderer branch for AI SDK reasoning parts", () => {
    const source = readFileSync("components/chat-message.tsx", "utf8");

    expect(source).toContain('partType === "reasoning"');
    expect(source).toContain("getReasoningText");
    expect(source).toContain("Reasoning");
  });
});
