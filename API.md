# API reference

Every HTTP route the app serves. All routes run on the **Node.js runtime** unless noted (`runtime = "nodejs"` in the file).

Auth model: every request passes through `middleware.ts`, which signs anonymous Supabase users on first visit when `SUPABASE_URL` + `SUPABASE_ANON_KEY` are set. Route handlers read the current user via `getCurrentUserId()`; RLS enforces isolation. Without Supabase configured, routes still work but meetings live in-memory and vanish on restart.

---

## Transcription — batch

### `POST /api/transcribe`

Upload an audio file, submit to AssemblyAI, return a job id.

**Request:**
- `Content-Type: multipart/form-data`
- Field `audio`: `File` — mp3, mp4, wav, webm, m4a, flac, ogg, aac
- Max size: 100 MB (hard cap). Vercel serverless limit is 4.5 MB — larger uploads need the storage-backed flow (not wired yet).

**Response:**
- `202 Accepted`
  ```json
  { "id": "<assemblyai-transcript-id>", "status": "queued" | "processing" }
  ```
- `400` — missing or empty audio field, or multipart parse error
- `402` — free-tier limit reached
  ```json
  {
    "error": "Free-tier limit reached (25/25 meetings). Upgrade to keep recording.",
    "code": "free_limit_reached",
    "upgradeUrl": "/pricing",
    "meetingsUsed": 25,
    "limit": 25
  }
  ```
- `413` — audio file exceeds 100 MB
- `502` — AssemblyAI upload or submit failed

Side-effects:
- Counts the user's existing meetings via `checkQuota()` before touching AssemblyAI.
- Inserts a placeholder `meetings` row (status: `processing`).

### `GET /api/transcribe/[id]`

Poll a batch job. On first transition to `completed`, generates summary + intake + cost breakdown and persists.

**Response:**
- `200 OK` — while in progress
  ```json
  { "id": "abc", "status": "queued" | "processing" }
  ```
- `200 OK` — on completion
  ```json
  {
    "id": "abc",
    "status": "completed",
    "text": "full transcript",
    "utterances": [
      { "speaker": "A", "text": "...", "start": 0, "end": 2200, "confidence": 0.98 }
    ],
    "durationSeconds": 245,
    "summary": {
      "title": "Q2 kickoff",
      "summary": "...",
      "keyPoints": ["..."],
      "actionItems": [{ "assignee": "Alice", "task": "...", "dueDate": null }],
      "decisions": ["..."],
      "participants": ["Speaker A", "Speaker B"]
    },
    "intakeForm": {
      "intent": "sales discovery call",
      "primaryParticipant": "Alice (Acme)",
      "organization": "Acme",
      "contactInfo": { "email": null, "phone": null },
      "budgetMentioned": "$50k pilot",
      "timeline": "end of Q2",
      "decisionMakers": ["Bob (CTO)"],
      "requirements": ["SOC 2"],
      "painPoints": ["Manual triage"],
      "nextSteps": ["Send security one-pager"]
    }
  }
  ```
- `200 OK` — on error from AssemblyAI
  ```json
  { "id": "abc", "status": "error", "error": "..." }
  ```
- `400` — missing id
- `502` — AssemblyAI fetch failed

Side-effect (on first completion): persists `cost_breakdown` alongside transcript + summary + intake. Subsequent polls short-circuit from the store. `after(flushLangfuse)` fires to upload OTel spans.

### `GET /api/transcribe/[id]/export`

Download the meeting as Markdown or PDF.

**Query:**
- `format=md` (default) → `text/markdown`
- `format=pdf` → `application/pdf`

**Response:**
- `200 OK` with `Content-Disposition: attachment; filename="<slug>.md|pdf"`
- `400` — unsupported format
- `404` — unknown meeting (RLS may be hiding it)

Render shape mirrors `/meetings/[id]` detail: title, metadata, summary sections (summary, key points, decisions, action items, participants), intake if populated, speaker-segmented transcript.

---

## Transcription — streaming (live)

### `POST /api/transcribe/stream/token`

Mints an AssemblyAI ephemeral token and allocates a meeting id. The browser opens a direct WebSocket to AssemblyAI with the token; the server never proxies audio.

**Response:**
- `200 OK`
  ```json
  {
    "token": "<ephemeral, 10min TTL>",
    "meetingId": "<UUID>",
    "expiresAt": 1718000000000,
    "sampleRate": 16000,
    "speechModel": "u3-rt-pro"
  }
  ```
- `402` — free-tier limit reached
- `502` — token mint failed

Side-effects:
- `checkQuota()` first (same 402 contract as batch).
- Inserts a placeholder `meetings` row.

### `POST /api/transcribe/stream/finalize`

Called by the browser when the live session ends. Accepts the accumulated utterances, runs summary + intake, persists, returns final shape.

**Request body:** (validated by Zod)
```json
{
  "meetingId": "<uuid from token endpoint>",
  "text": "full joined transcript",
  "utterances": [
    { "speaker": "A" | null, "text": "...", "start": 0, "end": 2200, "confidence": 1 }
  ],
  "durationSeconds": 145
}
```

**Response:** same `200 OK` shape as `GET /api/transcribe/[id]` on completion.
- `400` — invalid body

Side-effects: same as the batch completion path. `after(flushLangfuse)`.

---

## Meetings

### `GET /api/meetings?limit=50`

List recent meetings owned by the current user. Limit default 50, max 200.

**Response:**
- `200 OK`
  ```json
  {
    "items": [
      {
        "id": "abc",
        "status": "completed",
        "title": "Q2 kickoff",
        "durationSeconds": 245,
        "createdAt": "2026-04-18T10:00:00Z"
      }
    ]
  }
  ```

### `GET /api/meetings/[id]`

Full persisted meeting.

**Response:**
- `200 OK` — full `Meeting` shape (see `lib/meetings/types.ts`)
- `404` — not found or RLS denies

---

## Billing (Stripe)

### `POST /api/stripe/checkout`

Create a Stripe Checkout Session for the current user.

**Request body:**
```json
{ "tier": "core" | "pro" }
```

**Response:**
- `200 OK` → `{ "url": "https://checkout.stripe.com/..." }`
- `400` — invalid body
- `401` — no session
- `503` — `STRIPE_SECRET_KEY` or `STRIPE_PRICE_*` not configured

Side-effects:
- Creates a Stripe customer and stores the id on `profiles` if the user doesn't have one.
- Passes `client_reference_id: userId` so the webhook can correlate.

### `POST /api/stripe/webhook`

Stripe → our server. Signature-verified.

**Headers required:** `stripe-signature`
**Body:** Raw (Stripe signs the raw bytes — no JSON parse before verification).

**Events handled:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Response:**
- `200 OK` — event acknowledged (even if unhandled — returns `{ received: true, ignored: "<type>" }`)
- `400` — missing signature or verification failed
- `500` — handler failure (Stripe will retry)
- `503` — webhook secret not configured

Side-effects: upserts `profiles` row with `subscription_status`, `subscription_tier`, `current_period_end`.

---

## Observability

### `GET /api/ai-logs?limit=100`

Returns the in-memory ring buffer of AI call records from `lib/ai/telemetry.ts`. Per-process — different serverless instances have different logs.

**Response:**
- `200 OK` — array of `AILogRecord`

### `GET /api/ai-logs/errors?limit=50`

Error-only feed from the same ring buffer.

### `GET /api/ai-logs/stats`

Aggregates over the current ring: total calls, cost, tokens, p95 TTFT, error rate, model breakdown.

---

## Chat (reference)

### `POST /api/chat`

From the starter kit — streams a conversation with 3 reference tools (`searchDocuments`, `askQuestion`, `updateSettings`). Uses `streamText` from the AI SDK with `gateway(MODEL_ID)`. Not part of the Voxa product surface; kept because it's a good smoke test for the Gateway + telemetry + `after(flushLangfuse)` path.

**Request body:** `{ messages: UIMessage[] }`
**Response:** `UIMessageStreamResponse` (SSE-shaped stream compatible with `@ai-sdk/react`'s `useChat`).

---

## Auth

### `GET /auth/callback?code=...&next=/`

Magic-link exchange. `signInWithOtp` redirects here with the OTP code. We exchange for a session cookie and redirect to `next` (default `/`).

- `302` → `next` on success
- `302` → `/sign-in?error=<reason>` on failure

### `POST /auth/sign-out`

Signs the user out, clears the cookie, redirects home.

- `303` → `/`

POST-only so link previews / prefetchers can't log you out.

---

## Settings

### `GET /api/settings` / `POST /api/settings`

Cookie-backed user preferences: `summaryModel`, `batchSpeechModel`, `streamingSpeechModel`. See `lib/settings.ts`. `POST` merges a partial update.

---

## Static / app pages

| Route | Purpose |
|---|---|
| `/` | Hub — landing for the app |
| `/record` | Batch upload + browser mic recorder |
| `/record/live` | Streaming recorder (u3-rt-pro) |
| `/meetings` | Recent meetings list |
| `/meetings/[id]` | Detail: transcript + summary + intake + cost + export buttons |
| `/usage` | Lifetime + this-month totals |
| `/pricing` | Free / Core $15 / Pro $25 tiers |
| `/sign-in` | Magic-link form |
| `/profile` | Identity + subscription |
| `/settings` | Model picker |
| `/observability` | In-memory AI log feed |
| `/chat` | Reference chat demo |
| `/ai-starter` | Starter-kit hub (from scaffold) |

All server-rendered where dynamic, static where possible (see `next build` output in OPERATIONS.md).
