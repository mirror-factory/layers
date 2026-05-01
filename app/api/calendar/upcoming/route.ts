export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { withExternalCall } from "@/lib/with-external";
import { getCurrentUserId, getSupabaseUser } from "@/lib/supabase/user";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  decryptCalendarToken,
  encryptCalendarToken,
} from "@/lib/calendar/crypto";
import {
  CalendarProviderError,
  fetchUpcomingCalendarEvents,
  isCalendarProviderConfigured,
  parseCalendarProvider,
  refreshCalendarAccessToken,
  type CalendarProvider,
  type CalendarEventItem,
} from "@/lib/calendar/providers";

interface CalendarConnectionRow {
  provider: string;
  provider_account_email: string | null;
  status: string;
  updated_at: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
}

interface SupabaseGoogleSessionAccess {
  accessToken: string;
  accountEmail: string | null;
}

interface CalendarFetchState {
  items: CalendarEventItem[];
  reauthRequired: boolean;
  calendarFetchFailed: boolean;
  calendarRateLimited: boolean;
}

function limitFromUrl(req: Request): number {
  const value = new URL(req.url).searchParams.get("limit");
  const parsed = value ? Number.parseInt(value, 10) : 3;
  if (!Number.isFinite(parsed) || parsed < 1) return 3;
  return Math.min(parsed, 10);
}

async function getSupabaseGoogleSessionAccess(
  supabase: Awaited<ReturnType<typeof getSupabaseUser>>,
): Promise<SupabaseGoogleSessionAccess | null> {
  if (!supabase) return null;
  if (!("auth" in supabase) || !supabase.auth?.getSession) return null;

  const result = await supabase.auth.getSession().catch(() => null);
  const session = result?.data?.session as
    | {
        provider_token?: unknown;
        user?: { email?: unknown };
      }
    | null
    | undefined;
  const accessToken =
    typeof session?.provider_token === "string" && session.provider_token.trim()
      ? session.provider_token
      : null;

  if (!accessToken) return null;

  return {
    accessToken,
    accountEmail:
      typeof session?.user?.email === "string" ? session.user.email : null,
  };
}

async function fetchCalendarItemsForResponse(args: {
  provider: CalendarProvider;
  accessToken: string;
  limit: number;
  requestId: string;
  userId: string;
}): Promise<CalendarFetchState> {
  try {
    const items = await withExternalCall(
      {
        vendor: args.provider === "google" ? "google-calendar" : "microsoft-graph",
        operation: "calendar.events.list",
        modelId: "events.list",
        requestId: args.requestId,
        userId: args.userId,
      },
      () =>
        fetchUpcomingCalendarEvents(
          args.provider,
          args.accessToken,
          args.limit,
        ),
      {
        inputSummary: { provider: args.provider, limit: args.limit },
        summarizeResult: (result) => ({ eventCount: result.length }),
        usage: { unit: "request", amount: 1 },
      },
    );

    return {
      items,
      reauthRequired: false,
      calendarFetchFailed: false,
      calendarRateLimited: false,
    };
  } catch (error) {
    if (error instanceof CalendarProviderError && error.status === 401) {
      return {
        items: [],
        reauthRequired: true,
        calendarFetchFailed: false,
        calendarRateLimited: false,
      };
    }

    if (error instanceof CalendarProviderError && error.status === 429) {
      return {
        items: [],
        reauthRequired: false,
        calendarFetchFailed: false,
        calendarRateLimited: true,
      };
    }

    return {
      items: [],
      reauthRequired: false,
      calendarFetchFailed: true,
      calendarRateLimited: false,
    };
  }
}

export const GET = withRoute(async (req, ctx) => {
  const limit = limitFromUrl(req);
  const userId = await getCurrentUserId();
  const supabase = await getSupabaseUser();

  if (!userId || !supabase) {
    return NextResponse.json({
      connected: false,
      provider: null,
      accountEmail: null,
      items: [],
      limit,
      setupRequired: false,
      providerSetupRequired: false,
      reauthRequired: false,
      calendarFetchFailed: false,
      calendarRateLimited: false,
    });
  }

  const sessionGoogleAccess = await getSupabaseGoogleSessionAccess(supabase);

  const { data, error } = await supabase
    .from("calendar_connections")
    .select(
      "provider, provider_account_email, status, updated_at, access_token_enc, refresh_token_enc, token_expires_at",
    )
    .eq("user_id", userId)
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    const sessionFetchState = sessionGoogleAccess
      ? await fetchCalendarItemsForResponse({
          provider: "google",
          accessToken: sessionGoogleAccess.accessToken,
          limit,
          requestId: ctx.requestId,
          userId,
        })
      : null;

    return NextResponse.json({
      connected: Boolean(sessionGoogleAccess),
      provider: sessionGoogleAccess ? "google" : null,
      accountEmail: sessionGoogleAccess?.accountEmail ?? null,
      items: sessionFetchState?.items ?? [],
      limit,
      setupRequired: error.code === "42P01",
      providerSetupRequired: false,
      reauthRequired: sessionFetchState?.reauthRequired ?? true,
      calendarFetchFailed: sessionFetchState?.calendarFetchFailed ?? false,
      calendarRateLimited: sessionFetchState?.calendarRateLimited ?? false,
    });
  }

  const [connection] = (data ?? []) as CalendarConnectionRow[];
  const provider = parseCalendarProvider(connection?.provider);
  let fetchState: CalendarFetchState = {
    items: [],
    reauthRequired: false,
    calendarFetchFailed: false,
    calendarRateLimited: false,
  };
  let providerSetupRequired = false;

  if (connection && provider) {
    providerSetupRequired = !isCalendarProviderConfigured(provider);

    if (providerSetupRequired && provider === "google" && sessionGoogleAccess) {
      providerSetupRequired = false;
      fetchState = await fetchCalendarItemsForResponse({
        provider: "google",
        accessToken: sessionGoogleAccess.accessToken,
        limit,
        requestId: ctx.requestId,
        userId,
      });
    } else if (!providerSetupRequired) {
      let accessToken = decryptCalendarToken(connection.access_token_enc);
      const refreshToken = decryptCalendarToken(connection.refresh_token_enc);
      const expiresAt = connection.token_expires_at
        ? new Date(connection.token_expires_at).getTime()
        : null;
      const shouldRefresh =
        Boolean(refreshToken) &&
        (!expiresAt || expiresAt < Date.now() + 2 * 60 * 1000);

      if (shouldRefresh && refreshToken) {
        try {
          const refreshed = await refreshCalendarAccessToken(provider, refreshToken);
          accessToken = refreshed.accessToken;
          await getSupabaseServer()
            ?.from("calendar_connections")
            .update({
              access_token_enc: encryptCalendarToken(refreshed.accessToken),
              refresh_token_enc: encryptCalendarToken(
                refreshed.refreshToken ?? refreshToken,
              ),
              scopes: refreshed.scope,
              token_expires_at: refreshed.expiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("provider", provider);
        } catch {
          fetchState.reauthRequired = true;
        }
      }

      if (
        (!accessToken || fetchState.reauthRequired) &&
        provider === "google" &&
        sessionGoogleAccess
      ) {
        accessToken = sessionGoogleAccess.accessToken;
        fetchState.reauthRequired = false;
      }

      if (accessToken && !fetchState.reauthRequired) {
        fetchState = await fetchCalendarItemsForResponse({
          provider,
          accessToken,
          limit,
          requestId: ctx.requestId,
          userId,
        });
      } else if (!accessToken) {
        fetchState.reauthRequired = true;
      }
    }
  } else if (sessionGoogleAccess) {
    fetchState = await fetchCalendarItemsForResponse({
      provider: "google",
      accessToken: sessionGoogleAccess.accessToken,
      limit,
      requestId: ctx.requestId,
      userId,
    });
  } else {
    fetchState.reauthRequired = true;
  }

  return NextResponse.json({
    connected: Boolean(connection) || Boolean(sessionGoogleAccess),
    provider: connection?.provider ?? (sessionGoogleAccess ? "google" : null),
    accountEmail:
      connection?.provider_account_email ??
      sessionGoogleAccess?.accountEmail ??
      null,
    items: fetchState.items,
    limit,
    setupRequired: false,
    providerSetupRequired,
    reauthRequired: fetchState.reauthRequired,
    calendarFetchFailed: fetchState.calendarFetchFailed,
    calendarRateLimited: fetchState.calendarRateLimited,
  });
});
