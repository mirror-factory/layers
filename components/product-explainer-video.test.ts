import { describe, expect, it } from "vitest";
import { getProductExplainerEmbed } from "./product-explainer-video";

describe("getProductExplainerEmbed", () => {
  it("normalizes YouTube watch URLs to privacy-enhanced embeds", () => {
    expect(
      getProductExplainerEmbed("https://www.youtube.com/watch?v=abc123"),
    ).toEqual({
      provider: "youtube",
      embedUrl:
        "https://www.youtube-nocookie.com/embed/abc123?rel=0&modestbranding=1",
      watchUrl: "https://www.youtube.com/watch?v=abc123",
    });
  });

  it("normalizes Vimeo URLs to player embeds", () => {
    expect(getProductExplainerEmbed("https://vimeo.com/123456789")).toEqual({
      provider: "vimeo",
      embedUrl: "https://player.vimeo.com/video/123456789",
      watchUrl: "https://vimeo.com/123456789",
    });
  });

  it("rejects unsupported or malformed URLs", () => {
    expect(getProductExplainerEmbed("https://example.com/video")).toBeNull();
    expect(getProductExplainerEmbed("not a url")).toBeNull();
    expect(getProductExplainerEmbed(undefined)).toBeNull();
  });
});
