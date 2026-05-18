"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { NATIVE_OAUTH_REDIRECT_URL } from "@/lib/auth/native-oauth";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const NATIVE_AUTH_CALLBACK = new URL(NATIVE_OAUTH_REDIRECT_URL);
const DEFAULT_POST_LOGIN_PATH = "/record";

function safeInternalPath(value: string | null): string {
  if (!value?.startsWith("/")) return DEFAULT_POST_LOGIN_PATH;
  if (value.startsWith("//")) return DEFAULT_POST_LOGIN_PATH;
  return value;
}

async function handleNativeAuthUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }

  if (
    parsed.protocol !== NATIVE_AUTH_CALLBACK.protocol ||
    parsed.hostname !== NATIVE_AUTH_CALLBACK.hostname ||
    parsed.pathname !== NATIVE_AUTH_CALLBACK.pathname
  ) {
    return;
  }

  const [{ Browser }] = await Promise.all([import("@capacitor/browser")]);
  await Browser.close().catch(() => undefined);

  const code = parsed.searchParams.get("code");
  const next = safeInternalPath(parsed.searchParams.get("next"));

  if (!code) {
    window.location.href = "/sign-in?error=auth_callback_missing_code";
    return;
  }

  const supabase = getSupabaseBrowser();
  if (!supabase) {
    window.location.href = "/sign-in?error=auth_not_configured";
    return;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    window.location.href = "/sign-in?error=auth_exchange_failed";
    return;
  }

  window.location.href = next;
}

export function NativeAuthBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;
    let removeListener: (() => void) | null = null;

    void import("@capacitor/app")
      .then(async ({ App }) => {
        const launch = await App.getLaunchUrl();
        if (active && launch?.url) await handleNativeAuthUrl(launch.url);

        const listener = await App.addListener("appUrlOpen", event => {
          void handleNativeAuthUrl(event.url);
        });

        if (!active) {
          void listener.remove();
          return;
        }

        removeListener = () => {
          void listener.remove();
        };
      })
      .catch(() => undefined);

    return () => {
      active = false;
      removeListener?.();
    };
  }, []);

  return null;
}
