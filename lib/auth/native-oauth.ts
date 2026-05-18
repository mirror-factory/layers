"use client";

import { Capacitor } from "@capacitor/core";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Capacitor + Supabase Google OAuth (PROD-408).
 *
 * Why this exists:
 *   `supabase.auth.signInWithOAuth({ provider: "google" })` triggers a
 *   top-level `window.location.href` navigation. Inside Capacitor's
 *   WKWebView this hits two walls at once:
 *     1. Capacitor punts unallowlisted navigations to Safari.
 *     2. Google detects WebViews via User-Agent and refuses OAuth flows
 *        with `disallowed_useragent` (anti-phishing, non-negotiable).
 *
 * The fix:
 *   - Ask Supabase for the OAuth URL without redirecting
 *     (`skipBrowserRedirect: true`).
 *   - Open it in `@capacitor/browser` (SFSafariViewController overlay on
 *     iOS, Custom Tabs on Android) — Google considers these acceptable.
 *   - Set `redirectTo` to our custom URL scheme so Safari hands control
 *     back to the app after auth.
 *   - Listen for the deep-link via `App.addListener('appUrlOpen', …)`,
 *     parse the `code` param, and finish the PKCE exchange in-process
 *     via `supabase.auth.exchangeCodeForSession(code)`.
 *
 * The redirect URL must also be added to the Supabase project's
 * Authentication → URL Configuration → Redirect URLs allowlist.
 */

export const NATIVE_OAUTH_REDIRECT_URL =
  "com.mirafactory.layers://auth/callback";

/**
 * Detect whether we're running inside Capacitor (iOS or Android).
 * Centralised so tests can mock a single module path.
 */
export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Extract the OAuth `code` (or error) from a deep-link URL like
 * `com.mirafactory.layers://auth/callback?code=abc&state=...`.
 *
 * URL parsing of custom schemes is unreliable on some engines, so we
 * pull the query string by hand.
 */
export function parseAuthCallbackUrl(rawUrl: string): {
  code: string | null;
  error: string | null;
  errorDescription: string | null;
} {
  const queryIndex = rawUrl.indexOf("?");
  if (queryIndex === -1) {
    return { code: null, error: null, errorDescription: null };
  }
  const query = rawUrl.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  return {
    code: params.get("code"),
    error: params.get("error"),
    errorDescription: params.get("error_description"),
  };
}

type SignInOptions = {
  scopes?: string;
  /**
   * Where to send the user after a successful sign-in. Defaults to
   * `/record`. Web flow already supports `next` via the
   * `/auth/callback` route; on native we navigate inside the WebView
   * after the code exchange completes.
   */
  next?: string;
};

type NativeListenerHandle = { remove: () => Promise<void> | void };

type NativeAppPlugin = {
  addListener(
    event: "appUrlOpen",
    handler: (event: { url: string }) => void | Promise<void>,
  ): Promise<NativeListenerHandle> | NativeListenerHandle;
};

type SignInDeps = {
  supabase: SupabaseClient;
  /**
   * Lazily import Capacitor plugins. Tests can supply mocks here so we
   * never reach the real `@capacitor/*` runtime in jsdom/node.
   */
  loadBrowser?: () => Promise<{
    open: (options: { url: string; presentationStyle?: "popover" | "fullscreen" }) => Promise<void>;
    close?: () => Promise<void>;
    addListener?: (
      event: "browserFinished",
      handler: () => void | Promise<void>,
    ) => Promise<NativeListenerHandle> | NativeListenerHandle;
  }>;
  loadApp?: () => Promise<NativeAppPlugin>;
  /**
   * Override for tests. Defaults to `window.location.assign`.
   */
  navigate?: (url: string) => void;
};

const BROWSER_OPEN_SETTLE_MS = 750;

/**
 * Native-platform Google sign-in. Returns the registered listener
 * handle so callers can dispose it explicitly during teardown; in
 * normal use the listener removes itself once the exchange completes.
 *
 * Safe to call from web — it will throw if called outside a Capacitor
 * runtime, so callers should branch on `isNativePlatform()` first.
 */
export async function signInWithGoogleNative(
  options: SignInOptions = {},
  deps: SignInDeps,
): Promise<{ disposed: boolean }> {
  if (!isNativePlatform()) {
    throw new Error(
      "signInWithGoogleNative called outside a native Capacitor runtime",
    );
  }

  const { supabase } = deps;
  const next = options.next ?? "/record";

  const loadBrowser =
    deps.loadBrowser ??
    (async () => {
      const mod = await import("@capacitor/browser");
      const Browser = mod.Browser;
      return {
        open: Browser.open.bind(Browser),
        close: Browser.close?.bind(Browser),
        addListener: Browser.addListener?.bind(Browser),
      };
    });
  const loadApp =
    deps.loadApp ??
    (async () => {
      const mod = await import("@capacitor/app");
      const App = mod.App;
      return {
        addListener: App.addListener.bind(App),
      };
    });
  const navigate =
    deps.navigate ??
    ((url: string) => {
      if (typeof window !== "undefined") {
        window.location.assign(url);
      }
    });

  // 1. Build the OAuth URL without letting Supabase do the redirect.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      skipBrowserRedirect: true,
      redirectTo: NATIVE_OAUTH_REDIRECT_URL,
      ...(options.scopes ? { scopes: options.scopes } : {}),
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error("Supabase did not return an OAuth URL");

  // 2. Register the deep-link listener BEFORE opening the browser so
  //    we never miss the redirect on a fast network.
  const App = await loadApp();
  const Browser = await loadBrowser();

  let disposed = false;
  const handleRef: { current: { remove: () => Promise<void> | void } | undefined } = {
    current: undefined,
  };
  const browserFinishedRef: {
    current: { remove: () => Promise<void> | void } | undefined;
  } = {
    current: undefined,
  };

  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    try {
      await handleRef.current?.remove();
    } catch {
      // ignore
    }
    try {
      await browserFinishedRef.current?.remove();
    } catch {
      // ignore
    }
    try {
      await Browser.close?.();
    } catch {
      // ignore — overlay may already be closing
    }
  };

  const handleUrl = async (event: { url: string }) => {
    // Only react to our own callback scheme; the App listener fires
    // for every deep-link the OS hands us.
    if (!event?.url || !event.url.startsWith(NATIVE_OAUTH_REDIRECT_URL)) {
      return;
    }

    const { code, error: oauthError, errorDescription } =
      parseAuthCallbackUrl(event.url);

    try {
      if (oauthError) {
        throw new Error(errorDescription ?? oauthError);
      }
      if (!code) {
        throw new Error("Missing OAuth code in callback URL");
      }
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;

      navigate(next);
    } finally {
      await dispose();
    }
  };

  const registration = await App.addListener("appUrlOpen", handleUrl);
  handleRef.current = registration;

  const handleCancelledBrowser = async () => {
    await dispose();
    navigate("/sign-in?error=native_browser_closed");
  };

  if (Browser.addListener) {
    browserFinishedRef.current = await Browser.addListener(
      "browserFinished",
      handleCancelledBrowser,
    );
  }

  // 3. Open Google's consent screen as an in-app overlay. Capacitor Browser
  // implementations differ on whether the Promise resolves as soon as the
  // controller opens or when it closes. Do not keep the sign-in button pinned
  // in a loading state while the native browser owns the flow.
  await beginBrowserOpen(
    Browser.open({ url: data.url, presentationStyle: "fullscreen" }),
    async () => {
      await dispose();
      navigate("/sign-in?error=native_browser_open_failed");
    },
  );

  return {
    get disposed() {
      return disposed;
    },
  };
}

async function beginBrowserOpen(
  promise: Promise<unknown>,
  onLateFailure: () => Promise<void>,
): Promise<void> {
  let settled = false;
  let immediateError: unknown;

  promise
    .then(() => {
      settled = true;
    })
    .catch((error) => {
      settled = true;
      immediateError = error;
    });

  await new Promise((resolve) => setTimeout(resolve, BROWSER_OPEN_SETTLE_MS));

  if (immediateError) {
    throw immediateError;
  }

  if (!settled) {
    promise.catch(() => {
      void onLateFailure();
    });
  }
}
