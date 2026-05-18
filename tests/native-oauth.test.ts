import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CANONICAL_NATIVE_OAUTH_ORIGIN,
  NATIVE_OAUTH_REDIRECT_URL,
  NATIVE_OAUTH_WEB_CALLBACK_PATH,
  nativeOAuthRedirectTo,
  parseAuthCallbackUrl,
  signInWithGoogleNative,
} from "@/lib/auth/native-oauth";

const asClient = <T>(value: T) => value as unknown as SupabaseClient;

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn<() => boolean>(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: mocks.isNativePlatform,
  },
}));

type BrowserFinishedListener = () => void | Promise<void>;

function makeFakes() {
  const browserOpen = vi.fn().mockResolvedValue(undefined);
  const browserClose = vi.fn().mockResolvedValue(undefined);
  const removeBrowserFinished = vi.fn().mockResolvedValue(undefined);
  let capturedBrowserFinished: BrowserFinishedListener | undefined;
  const addBrowserListener = vi
    .fn()
    .mockImplementation(async (event: string, handler: BrowserFinishedListener) => {
      if (event !== "browserFinished") {
        throw new Error(`unexpected browser listener: ${event}`);
      }
      capturedBrowserFinished = handler;
      return { remove: removeBrowserFinished };
    });

  return {
    Browser: {
      open: browserOpen,
      close: browserClose,
      addListener: addBrowserListener,
    },
    removeBrowserFinished,
    browserOpen,
    browserClose,
    addBrowserListener,
    fireBrowserFinished: async () => {
      if (!capturedBrowserFinished) {
        throw new Error("browserFinished listener not registered");
      }
      await capturedBrowserFinished();
    },
  };
}

function makeSupabase(opts: { url?: string; exchangeError?: Error } = {}) {
  return {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({
        data: { url: opts.url ?? "https://accounts.google.com/o/oauth2/auth?foo=bar" },
        error: null,
      }),
      exchangeCodeForSession: vi
        .fn()
        .mockImplementation(async () =>
          opts.exchangeError
            ? { data: null, error: opts.exchangeError }
            : { data: { session: {} }, error: null },
        ),
    },
  };
}

describe("parseAuthCallbackUrl", () => {
  it("extracts the OAuth code from a custom-scheme URL", () => {
    const url = `${NATIVE_OAUTH_REDIRECT_URL}?code=abc-123&state=xyz`;
    expect(parseAuthCallbackUrl(url)).toEqual({
      code: "abc-123",
      error: null,
      errorDescription: null,
    });
  });

  it("returns nulls for a URL without query params", () => {
    expect(parseAuthCallbackUrl(NATIVE_OAUTH_REDIRECT_URL)).toEqual({
      code: null,
      error: null,
      errorDescription: null,
    });
  });

  it("surfaces oauth errors", () => {
    const url = `${NATIVE_OAUTH_REDIRECT_URL}?error=access_denied&error_description=User%20cancelled`;
    expect(parseAuthCallbackUrl(url)).toEqual({
      code: null,
      error: "access_denied",
      errorDescription: "User cancelled",
    });
  });
});

describe("nativeOAuthRedirectTo", () => {
  it("uses an HTTPS callback that can bounce back to the native scheme", () => {
    const redirectTo = new URL(nativeOAuthRedirectTo("/record"));

    expect(redirectTo.origin).toBe(CANONICAL_NATIVE_OAUTH_ORIGIN);
    expect(redirectTo.pathname).toBe(NATIVE_OAUTH_WEB_CALLBACK_PATH);
    expect(redirectTo.searchParams.get("native")).toBe("1");
    expect(redirectTo.searchParams.get("next")).toBe("/record");
  });

  it("rejects external next paths", () => {
    const redirectTo = new URL(nativeOAuthRedirectTo("//evil.test"));

    expect(redirectTo.searchParams.get("next")).toBe("/record");
  });
});

describe("signInWithGoogleNative", () => {
  beforeEach(() => {
    mocks.isNativePlatform.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("throws if called on web (non-native runtime)", async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    const supabase = makeSupabase();
    const fakes = makeFakes();

    await expect(
      signInWithGoogleNative(undefined, {
        supabase: asClient(supabase),
        loadBrowser: async () => fakes.Browser,
      }),
    ).rejects.toThrow(/outside a native Capacitor runtime/);
  });

  it("opens the Supabase OAuth URL in Browser.open and leaves code exchange to NativeAuthBridge", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    const supabase = makeSupabase();
    const fakes = makeFakes();
    const navigate = vi.fn();

    await signInWithGoogleNative(
      { next: "/record" },
      {
        supabase: asClient(supabase),
        loadBrowser: async () => fakes.Browser,
        navigate,
      },
    );

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: expect.objectContaining({
        skipBrowserRedirect: true,
        redirectTo: nativeOAuthRedirectTo("/record"),
      }),
    });
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(fakes.addBrowserListener).toHaveBeenCalledWith(
      "browserFinished",
      expect.any(Function),
    );
    expect(fakes.browserOpen).toHaveBeenCalledWith({
      url: "https://accounts.google.com/o/oauth2/auth?foo=bar",
      presentationStyle: "fullscreen",
    });
  });

  it("does not block the caller if the native browser open promise stays pending", async () => {
    vi.useFakeTimers();
    mocks.isNativePlatform.mockReturnValue(true);
    const supabase = makeSupabase();
    const fakes = makeFakes();
    fakes.browserOpen.mockImplementation(() => new Promise(() => undefined));

    const signIn = signInWithGoogleNative(
      { next: "/record" },
      {
        supabase: asClient(supabase),
        loadBrowser: async () => fakes.Browser,
      },
    );

    await vi.advanceTimersByTimeAsync(750);
    await expect(signIn).resolves.toMatchObject({ disposed: false });
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("surfaces immediate native browser open failures", async () => {
    vi.useFakeTimers();
    mocks.isNativePlatform.mockReturnValue(true);
    const supabase = makeSupabase();
    const fakes = makeFakes();
    fakes.browserOpen.mockRejectedValue(new Error("browser unavailable"));

    const signIn = signInWithGoogleNative(
      { next: "/record" },
      {
        supabase: asClient(supabase),
        loadBrowser: async () => fakes.Browser,
      },
    );
    const expectation = expect(signIn).rejects.toThrow(/browser unavailable/);

    await vi.advanceTimersByTimeAsync(750);
    await expectation;
  });

  it("disposes without redirecting when the native browser surface finishes", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    const supabase = makeSupabase();
    const fakes = makeFakes();
    const navigate = vi.fn();

    await signInWithGoogleNative(
      { next: "/record" },
      {
        supabase: asClient(supabase),
        loadBrowser: async () => fakes.Browser,
        navigate,
      },
    );

    await fakes.fireBrowserFinished();

    expect(fakes.removeBrowserFinished).toHaveBeenCalled();
    expect(fakes.browserClose).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
