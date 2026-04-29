# Feature Test And Marketing Matrix

Date: 2026-04-29

This is the working feature inventory for release QA, product demos, App Store
copy, and marketing materials. Treat "Ready to test" as implemented in the app
or API. Treat "Credentials required" as implemented but blocked on provider
setup for a live end-to-end test.

## Asset Index

- Device screenshots: `docs/app-store/device-screenshots/2026-04-29-release/`
- App Store benefit screenshots: `docs/app-store/marketing-screenshots/2026-04-29-release/`
- App Store screenshot source: `docs/design/app-store-screenshots.html`
- Screenshot workflow skill: `.claude/skills/app-store-screenshot-capture/SKILL.md`
- MCP setup guide: `docs/CLAUDE_MCP_TESTING.md`
- MCP/API contract guide: `docs/MCP_AND_API.md`
- Supabase OAuth setup: `docs/SUPABASE_MCP_OAUTH_SETUP.md`

## Primary Product Features

| Feature | Status | What to test | Marketing angle |
| --- | --- | --- | --- |
| Fast signed-in recorder home | Ready to test | Sign in, open `/`, verify date/time, wave ribbon, next calendar pill, start button, recent recordings, and no debug/provider copy on the main screen. Test iPhone and iPad layouts. | "Open and start recording fast." |
| Live meeting recording | Ready to test | Open `/record/live`, grant mic, start recording, speak for 30 seconds, verify transcript segments, timer, live state, local save status, stop/finalize flow, and resulting meeting. | "No bot in the room. Just start taking notes." |
| Microphone permission handling | Ready to test | Block mic, open `/record/live`, verify clear permission message. Allow mic and verify primary button changes to start recording. | "Built for real meeting starts, including browser permission recovery." |
| Live wave/ribbon animation | Ready to test | Check idle movement, active movement after mic access, light/dark themes, desktop and mobile crop/fade. | Premium visual identity for the capture moment. |
| Calendar-aware home context | Credentials required | Connect Google or Outlook, verify upcoming events in home side panel, date icon, event time/location, and next-meeting pill under recorder. | "Your next meeting is already understood." |
| Calendar-aware recording title | Credentials required | Connect calendar, start recording near an upcoming event, verify meeting title inherits event title through token creation, autosave, finalize, and meeting detail. | "Less manual naming after calls." |
| Recent recordings list | Ready to test | Verify row height, consistent duration glyph, processing title as "Writing notes...", completed rows without redundant status, zero-minute delete action, search/filter controls. | "Your meeting memory starts building immediately." |
| Empty recording library state | Ready to test | Use a clean account or mocked empty route, verify friendly empty state instead of blank list. | "Clear first-run experience." |
| Meeting detail notes | Ready to test | Open a completed meeting, verify summary, decisions, actions, transcript, note-first hierarchy, and no transcript box clutter. | "Leave with decisions and next steps, not raw text." |
| Meeting detail chat | Ready to test | Ask questions on a completed meeting with model configured and without model configured. Verify local fallback answers from saved notes/transcript. | "Ask questions grounded in the meeting." |
| Ask meeting library | Ready to test | Open `/ask`, search/ask across meetings, verify empty states, authenticated behavior, and results when embeddings exist. | "Ask what happened across every call." |
| Semantic search | Ready to test | Open `/search`, search exact terms and semantic topics, verify no-results state and result links. | "Find promises, objections, owners, and decisions." |
| Batch audio upload | Ready to test | Open `/record`, upload a supported audio file, verify transcribe request, processing state, result polling, and meeting creation. | "Capture old audio, too." |
| Recorder voice commands | Ready to test | During live recording say "Hey Layers remove that last thing" and verify the last segment is removed or private action handling appears. Try action-style commands. | "Correct notes while you speak." |

## Integrations And Automation

| Feature | Status | What to test | Marketing angle |
| --- | --- | --- | --- |
| MCP remote endpoint | Ready to test | `POST /api/mcp/mcp` initialize without auth; `tools/list` without auth returns 401; valid bearer token returns 8 tools. | "Bring meeting memory into Claude and other AI tools." |
| Claude MCP OAuth | Credentials required | Apply Supabase OAuth migration, set `MCP_JWT_SECRET`, use HTTPS app URL, add Claude custom connector, complete OAuth, ask Claude to show meeting dashboard. | "Secure connector access without copying API keys." |
| Claude MCP App UI | Ready to test | Run local preview command in `docs/MCP_AND_API.md`, verify light/dark dashboard preview and `show_meeting_dashboard` resource metadata. | "Interactive meeting dashboard inside Claude." |
| MCP API key mode | Ready to test | Generate profile API key, add bearer header, list tools, call `list_meetings`, verify user-scoped results. | Developer-friendly local connector testing. |
| Notes push package | Ready to test | On a completed meeting, copy notes package; call `prepare_notes_push` through MCP; verify destination and trigger are explicit and transcript remains opt-in. | "Push clean notes to your workflow safely." |
| Webhook destinations | Ready to test | Create webhook in Settings, subscribe to completed-meeting event, finalize a meeting, verify delivery log and signed payload behavior. | "Automate follow-up after the meeting ends." |
| Calendar reminders | Credentials required | Connect calendar, schedule next-meeting reminder in Settings, verify notification permission and scheduled reminder. | "Get nudged before the meeting starts." |

## Business And Admin Features

| Feature | Status | What to test | Marketing angle |
| --- | --- | --- | --- |
| Pricing page | Ready to test | Open `/pricing`, verify free/core/pro plans, Stripe checkout redirect, cancel/success redirect, and current plan state. | "Simple pricing for fast adoption." |
| Admin pricing dashboard | Operator-only | Open `/admin/pricing` with dev-kit/admin access, edit plan limits, minutes, model/provider costs, margins, and activate a config. | Internal margin control and scenario planning. |
| Usage and quota | Ready to test | Verify free limit, bypass/unlimited mode, preflight quota responses, and usage page. | "Know how minutes map to plan economics." |
| Model defaults | Ready to test | Open Settings/Admin model controls, verify GPT 5.4 nano default notes model and Universal Streaming Multilingual 1 live transcription default. | "Fast defaults, configurable lanes." |
| Provider cost source of truth | Ready to test | Verify `/api/models`, admin pricing, and recorder preflight all agree on active provider/model costs. | "Costs are visible before they surprise you." |
| Stripe checkout | Credentials required | Start checkout, complete Stripe test payment, verify redirect and profile/subscription state. | "Upgrade when usage grows." |

## Account, Auth, And Security

| Feature | Status | What to test | Marketing angle |
| --- | --- | --- | --- |
| Email/password sign in | Ready to test | Sign in with an existing Supabase user, verify redirect to signed-in recorder home. | Standard account access. |
| Google sign in | Credentials required | Configure Supabase Google provider, sign in with Google, verify callback and signed-in home. | Lower-friction onboarding. |
| Sign up | Ready to test | Create a test user, verify account confirmation path and signed-in state. | "Start free." |
| API key management | Ready to test | Open profile, generate/revoke API key, verify masked display and MCP bearer behavior. | "Power users can connect external AI tools." |
| OAuth consent page | Ready to test | Start `/api/oauth/authorize` with PKCE params, verify consent page, invalid params, and auth redirect behavior. | Secure connector authorization. |
| RLS/user scoping | Ready to test | Use two accounts/API keys, verify meetings/search/MCP only return the caller's data. | Private meeting memory. |

## Operator And Developer Surfaces

| Feature | Status | What to test | Marketing angle |
| --- | --- | --- | --- |
| Health endpoint | Ready to test | `GET /api/health`, verify Supabase, Langfuse, AssemblyAI statuses. | Release confidence, not user-facing. |
| Observability page | Operator-only | Open `/observability`, verify logs, errors, stats, mobile overflow, and refresh behavior. | Internal reliability. |
| Control plane/dev-kit | Operator-only | Open `/control-plane` and `/dev-kit/status`, verify evidence, coverage, registries, and runs. | Internal release operating system. |
| API route contracts | Ready to test | Run `pnpm test:contracts`; verify route auth/status contract coverage. | Internal quality. |
| MCP tests | Ready to test | Run `pnpm test:mcp`; verify protocol, auth, tool behavior. | Connector confidence. |
| Device screenshot capture | Ready to test | Run `pnpm screenshots:devices` with screenshot credentials; verify iPhone/iPad light/dark output. | Reusable App Store asset process. |
| Marketing screenshot capture | Ready to test | Run `node scripts/generate-app-store-screenshots.mjs`; verify five benefit screenshots and metadata. | Repeatable launch creative. |

## Manual Release Test Script

1. Sign in and open `/`.
2. Verify signed-in recorder home on desktop, iPhone, and iPad widths.
3. Start a live recording, speak, stop, and open the completed meeting.
4. Verify summary, actions, decisions, transcript, chat, notes package, and export.
5. Search for the meeting from `/ask`, `/search`, and `/meetings`.
6. Connect calendar credentials in Settings and verify upcoming meeting context.
7. Generate/revoke API key in Profile.
8. Run MCP initialize, unauthenticated `tools/list`, authenticated `tools/list`,
   and `show_meeting_dashboard`.
9. Start Stripe test checkout and verify success/cancel redirects.
10. Run screenshots:
    - `pnpm screenshots:devices`
    - `node scripts/generate-app-store-screenshots.mjs`
11. Run verification:
    - `pnpm typecheck`
    - `pnpm test`
    - `npx eslint .`
    - `npx ai-dev-kit tool validate`
    - `pnpm gates`

## Marketing Pillars

1. Fast capture: open the app and start a meeting note immediately.
2. Private recording: no meeting bot has to join the room.
3. Structured intake: calls become decisions, owners, risks, and follow-ups.
4. Meeting memory: ask/search across the full conversation library.
5. Calendar context: upcoming meetings prefill the capture experience.
6. Connector layer: Claude and other MCP clients can access meeting memory with
   OAuth or scoped API keys.
7. Cost control: transcription, model choice, limits, and margins are visible.

## Claims To Avoid Until Further Proof

- Do not claim "fully automatic" calendar setup until Google and Outlook
  provider credentials are configured in production.
- Do not claim third-party note push to Slack, Linear, Notion, or email until
  explicit destination auth and sender implementations exist.
- Do not claim benchmark superiority over Granola, Otter, Fathom, or Notion
  until there is a dated independent evaluation or internal test report.
- Do not claim local/offline transcription as the default; the current default
  live transcription lane is Universal Streaming Multilingual 1.
