import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("generated design token CSS", () => {
  it("does not include YAML inline comments in custom property values", () => {
    const css = readFileSync(join(process.cwd(), "app/styles/tokens.css"), "utf-8");

    expect(css).toContain("--layers-ink: oklch(0.22 0.035 256);");
    expect(css).toContain("--brand-accent-subtle: oklch(0.56 0.12 170);");
    expect(css).not.toContain("# page background");
    expect(css).not.toMatch(/--[a-z0-9-]+:\s*[^;]*"\s*#/);
  });
});
