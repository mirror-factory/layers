import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  NATIVE_OAUTH_REDIRECT_URL,
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

type Listener = (event: { url: string }) => void | Promise<void>;

function makeFakes() {
  const browserOpen = vi.fn().mockResolvedValue(undefined);
  const browserClose = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn().mockResolvedValue(undefined);
  let captured: Listener | undefined;
  const addListener = vi
    .fn()
    .mockImplementation(async (_event: string, handler: Listener) => {
      captured = handler;
      return { remove };
    });

  return {
    Browser: { open: browserOpen, close: browserClose },
    App: { addListener },
    remove,
    browserOpen,
    browserClose,
    fireDeepLink: async (url: string) => {
      if (!captured) throw new Error("listener not registered");
      await captured({ url });
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
        loadApp: async () => fakes.App,
        loadBrowser: async () => fakes.Browser,
      }),
    ).rejects.toThrow(/outside a native Capacitor runtime/);
  });

  it("opens the Supabase OAuth URL in Browser.open and registers a deep-link listener", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    const supabase = makeSupabase();
    const fakes = makeFakes();
    const navigate = vi.fn();

    await signInWithGoogleNative(
      { next: "/record" },
      {
        supabase: asClient(supabase),
        loadApp: async () => fakes.App,
        loadBrowser: async () => fakes.Browser,
        navigate,
      },
    );

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: expect.objectContaining({
        skipBrowserRedirect: true,
        redirectTo: NATIVE_OAUTH_REDIRECT_URL,
      }),
    });
    expect(fakes.App.addListener).toHaveBeenCalledWith(
      "appUrlOpen",
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
        loadApp: async () => fakes.App,
        loadBrowser: async () => fakes.Browser,
      },
    );

    await vi.advanceTimersByTimeAsync(750);
    await expect(signIn).resolves.toMatchObject({ disposed: false });
    expect(fakes.App.addListener).toHaveBeenCalledWith(
      "appUrlOpen",
      expect.any(Function),
    );
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
        loadApp: async () => fakes.App,
        loadBrowser: async () => fakes.Browser,
      },
    );
    const expectation = expect(signIn).rejects.toThrow(/browser unavailable/);

    await vi.advanceTimersByTimeAsync(750);
    await expectation;
  });

  it("exchanges the deep-link code and navigates to next on success", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    const supabase = makeSupabase();
    const fakes = makeFakes();
    const navigate = vi.fn();

    await signInWithGoogleNative(
      { next: "/record" },
      {
        supabase: asClient(supabase),
        loadApp: async () => fakes.App,
        loadBrowser: async () => fakes.Browser,
        navigate,
      },
    );

    await fakes.fireDeepLink(`${NATIVE_OAUTH_REDIRECT_URL}?code=the-code`);

    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("the-code");
    expect(navigate).toHaveBeenCalledWith("/record");
    expect(fakes.remove).toHaveBeenCalled();
    expect(fakes.browserClose).toHaveBeenCalled();
  });

  it("ignores deep-link events for unrelated URL schemes", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    const supabase = makeSupabase();
    const fakes = makeFakes();
    const navigate = vi.fn();

    await signInWithGoogleNative(
      { next: "/record" },
      {
        supabase: asClient(supabase),
        loadApp: async () => fakes.App,
        loadBrowser: async () => fakes.Browser,
        navigate,
      },
    );

    await fakes.fireDeepLink("https://layers.mirrorfactory.ai/something");

    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(fakes.remove).not.toHaveBeenCalled();
  });

  it("does not call exchange when the OAuth provider returns an error", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    const supabase = makeSupabase();
    const fakes = makeFakes();
    const navigate = vi.fn();

    await signInWithGoogleNative(
      { next: "/record" },
      {
        supabase: asClient(supabase),
        loadApp: async () => fakes.App,
        loadBrowser: async () => fakes.Browser,
        navigate,
      },
    );

    await expect(
      fakes.fireDeepLink(
        `${NATIVE_OAUTH_REDIRECT_URL}?error=access_denied&error_description=denied`,
      ),
    ).rejects.toThrow(/denied/);

    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(fakes.remove).toHaveBeenCalled();
    expect(fakes.browserClose).toHaveBeenCalled();
  });
});
