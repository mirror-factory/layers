# GitHub + Vercel + Cloudflare Release Flow Verification

Date: 2026-05-18

## GitHub

Repository: `mirror-factory/layers`

| Branch | Role | Protection |
|---|---|---|
| `development` | default integration branch | PR review required, strict status checks enabled |
| `staging` | pre-production branch | PR review required, strict status checks enabled |
| `main` | production branch | PR review required, strict status checks enabled |

Required checks observed on protected branches include:

- `Tier 0-1 Fast Gates`
- `Tier 2 Focused Browser Proof`
- `Web (Vercel)` on staging/main

## Vercel Domains

Project: `audio-layer`
Project ID: `prj_QUjIKb0gKB5KxDI0lulFnKfgAZhP`

| Domain | Verified | Branch |
|---|---:|---|
| `layers.mirrorfactory.ai` | true | production / main |
| `dev.layers.mirrorfactory.ai` | true | `development` |
| `staging.layers.mirrorfactory.ai` | true | `staging` |

## Cloudflare DNS

Authoritative nameserver check against `bowen.ns.cloudflare.com` returned:

```text
layers.mirrorfactory.ai CNAME 03e5eba20f4a886c.vercel-dns-017.com
dev.layers.mirrorfactory.ai CNAME cname.vercel-dns.com
staging.layers.mirrorfactory.ai CNAME cname.vercel-dns.com
_vercel.mirrorfactory.ai TXT vc-domain-verify=dev.layers.mirrorfactory.ai,ab5d9cd48927b35731e8
_vercel.mirrorfactory.ai TXT vc-domain-verify=staging.layers.mirrorfactory.ai,e55419497a240a420457
_vercel.mirrorfactory.ai TXT vc-domain-verify=layers.mirrorfactory.ai,d2718b5456f1b42f1884,dc
```

## Promotion Flow

Use:

```text
feature/release branch -> development -> staging -> main
```

Expected domain behavior:

- PR/feature branch gets Vercel preview deployment.
- Merge to `development` updates `dev.layers.mirrorfactory.ai`.
- Merge to `staging` updates `staging.layers.mirrorfactory.ai`.
- Merge to `main` updates `layers.mirrorfactory.ai`.

## Google Auth Retest

Local sign-in retest against `.env.local` aligned to production Supabase:

- Supabase authorize URL: `https://psatqzrakxauktmzahfc.supabase.co/auth/v1/authorize`
- Google URL: `https://accounts.google.com/...`
- Local web redirect target: `http://localhost:3101/auth/callback?next=/record`
- No `layers.hustletogether.com` URL appeared in the OAuth request chain.

Native OAuth remains configured to use:

```text
com.mirafactory.layers://auth/callback
```
