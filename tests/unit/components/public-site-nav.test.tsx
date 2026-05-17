// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicSiteNav } from "@/components/public-site-nav";

const mocks = vi.hoisted(() => ({
  pathname: vi.fn(() => "/"),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname(),
}));

describe("PublicSiteNav", () => {
  afterEach(() => {
    cleanup();
    mocks.pathname.mockReturnValue("/");
  });

  it("exposes required legal and product links in the anonymous mobile drawer", () => {
    render(<PublicSiteNav />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = within(screen.getByRole("button", { name: "Close menu" })
      .closest("header")!
      .querySelector("#mobile-nav-panel")!);

    expect(drawer.getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      "/download",
    );
    expect(drawer.getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(drawer.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(drawer.getByRole("link", { name: "Changelog" })).toHaveAttribute(
      "href",
      "/changelog",
    );
    expect(drawer.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "/docs",
    );
    expect(drawer.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(drawer.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
  });
});
