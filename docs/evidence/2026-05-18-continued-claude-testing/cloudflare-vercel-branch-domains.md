# Cloudflare + Vercel Branch Domain Setup

Date: 2026-05-18

## Goal

Wire the three-domain release flow:

| Git branch | Domain | Vercel status |
|---|---|---|
| `main` | `layers.mirrorfactory.ai` | Already verified |
| `development` | `dev.layers.mirrorfactory.ai` | Verified in this pass |
| `staging` | `staging.layers.mirrorfactory.ai` | Verified in this pass |

## Cloudflare DNS Records Added

| Type | Name | Value | Proxy |
|---|---|---|---|
| CNAME | `dev.layers` | `cname.vercel-dns.com` | DNS only |
| CNAME | `staging.layers` | `cname.vercel-dns.com` | DNS only |
| TXT | `_vercel` | `vc-domain-verify=dev.layers.mirrorfactory.ai,ab5d9cd48927b35731e8` | DNS only |
| TXT | `_vercel` | `vc-domain-verify=staging.layers.mirrorfactory.ai,e55419497a240a420457` | DNS only |

Authoritative Cloudflare nameservers returned the new records immediately:

```text
bowen.ns.cloudflare.com:
  TXT _vercel.mirrorfactory.ai -> dev + staging + production verification records
  CNAME dev.layers.mirrorfactory.ai -> cname.vercel-dns.com
  CNAME staging.layers.mirrorfactory.ai -> cname.vercel-dns.com

cora.ns.cloudflare.com:
  TXT _vercel.mirrorfactory.ai -> dev + staging + production verification records
  CNAME dev.layers.mirrorfactory.ai -> cname.vercel-dns.com
  CNAME staging.layers.mirrorfactory.ai -> cname.vercel-dns.com
```

## Vercel Verification

Commands:

```bash
vercel api '/v9/projects/prj_QUjIKb0gKB5KxDI0lulFnKfgAZhP/domains/dev.layers.mirrorfactory.ai/verify' --scope mirror-factorys-projects-836be98a -X POST
vercel api '/v9/projects/prj_QUjIKb0gKB5KxDI0lulFnKfgAZhP/domains/staging.layers.mirrorfactory.ai/verify' --scope mirror-factorys-projects-836be98a -X POST
```

Result:

| Domain | Verified | Git branch |
|---|---:|---|
| `dev.layers.mirrorfactory.ai` | true | `development` |
| `staging.layers.mirrorfactory.ai` | true | `staging` |

## Follow-Up

Revoke the temporary Cloudflare API token used for DNS edit after this run.
