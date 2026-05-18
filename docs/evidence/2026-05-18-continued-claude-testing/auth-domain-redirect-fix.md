# Auth Domain Redirect Fix

Date: 2026-05-18

## User-Observed Issue

During the iOS simulator Google sign-in flow, the in-app browser opened correctly, but after login the flow redirected to `layers.hustletogether.com` instead of the Mirror Factory Layers domain.

## Root Cause Found

The simulator was running the local dev server, and local `.env.local` was pointed at a different Supabase project than Vercel production.

| Surface | Supabase project ref | App URL |
|---|---|---|
| Local `.env.local` before fix | `fenhyfxbapybmddvhcei` | not aligned with Vercel production |
| Vercel production | `psatqzrakxauktmzahfc` | `https://layers.mirrorfactory.ai` |

Tracked source did not contain `layers.hustletogether.com` in runtime auth config. The stale redirect was therefore coming from the Supabase project configuration used by local QA, not from the branch code.

## Fixes Applied

1. Updated ignored local `.env.local` to match the Vercel production public auth settings:
   - `NEXT_PUBLIC_APP_URL=https://layers.mirrorfactory.ai`
   - `NEXT_PUBLIC_SUPABASE_URL=https://psatqzrakxauktmzahfc.supabase.co`
   - `VITE_SUPABASE_URL=https://psatqzrakxauktmzahfc.supabase.co`
   - Matching public anon keys were copied from Vercel production into the local ignored env file.
2. Added `tests/auth-domain-config.test.ts` to fail if runtime auth/native shell config references stale Hustle Together domains.
3. Confirmed the production Vercel project is linked locally:
   - Vercel org/project: `mirror-factory` / `audio-layer`
   - Project ID: `prj_QUjIKb0gKB5KxDI0lulFnKfgAZhP`

## Access Gap

Supabase CLI is authenticated to `CrazySwami's Org`, but it cannot read API/auth config for either Layers Supabase project:

```text
unexpected get api keys status 403:
Your account does not have the necessary privileges to access this endpoint.
```

Because of that, this shell cannot currently verify or update the live Supabase Auth URL Configuration.

## Live Supabase Settings That Need Verification

In the production Supabase project `psatqzrakxauktmzahfc`, verify:

| Setting | Required value |
|---|---|
| Site URL | `https://layers.mirrorfactory.ai` |
| Redirect URL | `https://layers.mirrorfactory.ai/auth/callback` |
| Redirect URL | `https://staging.layers.mirrorfactory.ai/auth/callback` |
| Redirect URL | `https://dev.layers.mirrorfactory.ai/auth/callback` |
| Redirect URL | `http://localhost:3000/auth/callback` |
| Redirect URL | `http://localhost:3101/auth/callback` |
| Redirect URL | `com.mirafactory.layers://auth/callback` |

Also remove any stale `layers.hustletogether.com` URL from Site URL or Redirect URLs.

## Verification Run

`pnpm exec vitest run tests/auth-domain-config.test.ts tests/native-oauth.test.ts --passWithNoTests`

Result: PASS, 13 tests.
