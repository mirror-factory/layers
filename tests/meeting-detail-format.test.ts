import { describe, expect, it } from "vitest";
import { formatCompletedActionDueLabel } from "@/lib/meetings/format";

describe("meeting detail due labels", () => {
  it("formats ISO due dates for compact action rows", () => {
    expect(formatCompletedActionDueLabel("2026-05-06")).toBe("May 6");
  });

  it("keeps natural-language due dates instead of throwing during render", () => {
    expect(formatCompletedActionDueLabel("next Friday")).toBe("next Friday");
  });

  it("omits empty due dates", () => {
    expect(formatCompletedActionDueLabel(null)).toBeNull();
    expect(formatCompletedActionDueLabel("   ")).toBeNull();
  });
});
