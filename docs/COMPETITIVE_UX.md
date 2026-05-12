# Competitive UX research — Layers vs. meeting-AI peers

> Research compiled May 2026 for the Mirror Factory team. The brief: don't chase feature parity, find **UX wins** Layers can borrow. Special focus on chat and templates.
> Sources are footnoted; where a question could not be answered from public materials it is marked _unverified_.

---

## 1. Granola UX deep-dive

Granola is the product to beat. Below is a walkthrough grounded in the marketing site, official docs/changelog, and several independent reviews.[^granola][^chat][^twozero][^updates][^docs-templates][^tldv][^bluedot][^zack][^antill][^medium][^intelligent]

### 1.1 Marketing site → install

- **Headline:** _"Granola — The AI Notepad for back-to-back meetings."_ Subhead: _"Granola takes your raw meeting notes and makes them awesome."_[^granola]
- The hero is a quiet white page. No screenshot carousel, no aggressive gradient. A handwritten SVG ("handwriting-calmer.svg") sits beside the headline — the **only** distinctive flourish on a page that otherwise reads like a thoughtful blog post.[^granola]
- Social proof leads with named-and-faced quotes (Nat Friedman, Guillermo Rauch, Des Traynor). Rauch: _"It's actually unbelievable how good granola.ai is. It replaces writing documents."_ Logos (PostHog, Intercom, Ramp, Linear, Brex, Replit, Vercel) live below the fold — they don't lean on a "trusted by" wall.[^granola]
- The CTA copy is intentionally low-stakes: _"Try Granola for a few meetings today. It's free to get started."_ ("a few meetings" is a smart cognitive frame — implies time-bounded trial without making you commit.)[^granola]
- Install is a desktop binary (macOS/Windows). Calendar permission is requested up front; that single permission unlocks auto-detection.[^bluedot]

### 1.2 First meeting

- When a calendar event with 2+ attendees is within ~1 minute, Granola posts a **system-level notification** offering to start recording. No bot joins, no prompt to invite anyone — Granola captures system audio.[^zack][^bluedot]
- The first time the app opens during a call you see a deliberately minimal **split-screen editor**: live transcript scrolls in one pane, your own notes pane is _a blank canvas, akin to Apple Notes or Google Docs_.[^antill][^medium]
- The during-meeting UI is intentionally boring: _"no AI distraction or weird UI: just a notepad."_[^medium] Reviewers consistently land on this point — the absence of AI surface during the call is itself a design choice.
- Empty state for the transcript pane is a small floating circle at the bottom; clicking it expands the live transcript. (This circle is also where Cmd+J / Cmd+T summon chat — see 1.4.) Several reviewers got lost here on first run.[^tldv]

### 1.3 Second meeting + daily usage

- After a call ends, Granola runs the template against your raw notes + transcript and produces the "awesome" version. Your raw notes remain as a togglable view. The conceptual model — _your notes, enhanced_ — is the thing that's stuck in users' heads.[^zack][^medium]
- Notes render in a Notion-style block editor. Reviewers describe the surface as "comfortingly familiar."[^antill]
- Calendar-linked auto-detection means the steady state for daily usage is: receive notification → click start → close laptop lid feeling → notes appear. The product disappears into the background. This is the single biggest UX lesson.

### 1.4 Where does chat live?

This is the question the CPO asked specifically. Public materials confirm:

- **In-meeting:** chat is summoned by **Cmd+J** (older shortcut) or **Cmd+T** (post-Sept-2025 rebuild) or by clicking the live-transcript pill at the bottom of the notes pane.[^chat][^tldv][^alt-cmd-t]
- **Post-meeting:** chat sits inline at the bottom of the meeting note (same shortcut works) and inside folder views to query across many meetings.[^twozero]
- **Standalone:** there is a dedicated `/chat` route ("Granola Chat") with cross-folder reach. The page positions it as: _"AI that already knows what you're working on."_[^chat]
- **Quick chips** on the chat surface are contextual examples, not generic prompts. The marketing site quotes: _"What's been discussed so far?"_ (during a meeting), _"What are our top feature requests?"_ (within a folder), _"Can I contribute more in meetings?"_ (across all meetings).[^chat]
- **Recipes:** Granola's name for prompt templates inside chat. Trigger with `/` ("Hit / in chat for quick access to all your Recipes").[^chat] Recipes are expert-written, you can save your own, and folder templates ship with pre-loaded Recipes so a new team member arrives to working starter prompts on Day 1.[^twozero]
- **Replies render with inline citations + jump-to-source.** Cited transcript lines are clickable and seek to the moment in the recording — _"so your team moves from anecdotes to evidence in seconds."_[^twozero]
- **History limitations:** independent reviewers note Ask-Granola conversations historically vanished when you left a meeting; the v2 rebuild seems to have improved this but it's not loudly advertised.[^tldv]
- **Voice activation** was added with the Cmd+T rebuild — click the mic in the chat surface or trigger with Cmd+T to dictate the query.[^alt-cmd-t]

### 1.5 Templates

- 29 built-in templates + custom templates. Selection happens either at meeting start (pick from a menu) or auto-suggested from "meeting title and description" + previous patterns.[^updates][^docs-templates]
- Custom templates are created from **Settings → Manage templates** or _"All Templates…"_ inside the template menu. They are private by default; one-click toggle to share with the org.[^docs-templates]
- Recommended template structure (per Granola's own docs): _set the purpose and context with a description of what you hope to get out of the meeting, specify length and style, and outline structure using template sections._[^docs-templates] This guidance is shown _inside_ the template editor, not buried in a help article.
- A `2.0` move worth noticing: **folder templates** bundle structure + permissions + Recipes (chat prompts). Picking "User Research" or "Sales Pipeline" pre-loads the whole working context, not just a note format.[^twozero]
- Cold start: the in-product onboarding includes a sample meeting note so the empty homepage is never truly empty (per multiple reviews — the app shows you a finished example so you understand what "good" looks like before you record).[^bluedot][^medium]

---

## 2. Where Granola is technically/aesthetically distinctive

Five to eight non-obvious design moves, with copy-effort estimates for our stack (Next.js 15 + Tailwind v4 + Paper Calm).

1. **The "raw notes ↔ enhanced notes" toggle.** Users can flip between what they wrote and what the AI wrote. This makes the AI feel like a collaborator on top of the user's authorship rather than a replacement. _Cheap to copy_ — it's a tab over the same content.
2. **Handwriting-style SVG accents** ("handwriting-calmer.svg" on the marketing page, occasional underline scribbles in the product). Communicates "your notes" rather than "AI output." _Trivial_ — author 2-3 inline SVG flourishes; use sparingly.
3. **The bottom pill that expands to the live transcript.** Single floating affordance at the bottom of the notes pane. It's also the chat handle. This collapses three competing surfaces (notes, transcript, chat) into one progressive disclosure. _Cheap_ — a fixed-position pill with two expand states.
4. **Cmd+J / Cmd+T to summon chat globally.** Hotkey is _the_ primary way power users hit chat. There's no big "Ask AI" button competing for attention. _Cheap_ — a global keydown listener that opens a sheet/modal.
5. **Quick-chip prompts are context-aware, not generic.** The chip on a meeting page differs from the chip on a folder page differs from the chip on the global chat. _Medium_ — needs per-surface logic but is small per-surface.
6. **Inline citations as clickable transcript-seekers.** `[S12]` style pills jump the transcript to the cited moment. Layers already does the citation rendering (we found `[S{n}]` regex in `components/chat-message.tsx`), but not the cross-pane seek. _Cheap-Medium_ — wire `onCitationClick` to scroll the transcript pane.
7. **Folder = workspace bundle.** Picking a folder template loads structure + permissions + chat prompts in one move. _Medium-Large_ — meaningful schema work, but the UX is a single picker.
8. **Restraint as a design move.** No animated brand mascot, no AI sparkles, no purple gradient. Geist/system sans, white surfaces, mint accents. The brand statement _is_ the absence of theatre. _Cheap (and counter to most "AI app" instincts)._
9. **Voice tone in product copy.** _"Granola takes your raw meeting notes and makes them awesome."_ Not _"Leverage AI to unlock conversational intelligence."_ Buttons say "Done" and "Share" not "Confirm action" and "Distribute artifact." _Free_ — discipline, not engineering.

---

## 3. Comparative scan — Otter, Fireflies, Tactiq, Read.ai

**Otter.ai.** Differentiator: scale and depth of integrations, plus _"the world's only Conversational Knowledge Engine"_ framing.[^otter] Chat is "Otter AI Chat" — _"Ask Otter anything"_ — a sidebar/panel that can answer across meetings and connected apps; they also expose an MCP server so external models can query meeting knowledge.[^otter] **Steal:** the MCP server angle is good positioning for power users; their channel-by-team-or-project organization is solid. **Ignore:** the dense feature-grid landing page; the brand feels like 2018 SaaS.

**Fireflies.ai.** Differentiator: high transcription accuracy + "200+ AI Skills" — pre-built specialized prompts per industry.[^ff] AskFred lives in a dedicated section and is framed: _"Let Fred review your meetings and come back with answers."_[^ff] **Steal:** the named-assistant framing ("Fred", an entity rather than a feature) gives chat a personality the others lack. **Ignore:** the maximalist tabbed summary UI (Overview / Bullet Points / Action Items / Custom Notes) — visual noise.

**Tactiq.io.** Differentiator: lives _inside_ Google Meet/Zoom/Teams as a Chrome extension, with real-time in-meeting AI prompts.[^tactiq] Hero: _"Focus on the meeting, let AI handle the notes."_ The strongest line: _"The meeting ended. The notes were already written."_[^tactiq] **Steal:** in-meeting "Ask AI" — a streaming card while the call is happening — is a chat surface Layers doesn't have. **Ignore:** browser-extension-only distribution; their workflow integration story (Slack/Linear/HubSpot/Notion) is broad but shallow.

**Read.ai.** Differentiator: cross-channel ("meetings, email, messages") with "Ada", a digital-twin assistant.[^read] Chat is centered on a homepage-style interactive Ada surface plus a "Search Copilot" across sources. **Steal:** treating chat as the home page (not buried in a meeting) is bolder than Granola's pill — worth considering as a complement. **Ignore:** the digital-twin / sentiment-meter framing; reviewers find it gimmicky and it's not Layers' positioning.

---

## 4. UX gap analysis vs Layers

Grounded in `app/chat/page.tsx`, `components/meeting-chat.tsx`, `components/chat-input.tsx`, `components/chat-message.tsx`, `app/meetings/[id]/page.tsx`, and `DESIGN.md`. Layers already has more chat machinery than the team gives itself credit for — citations, templates as chips, two variants of the chat surface. The gap is mostly _placement_, _copy_, and _polish_, not capability.

| What Granola does | What Layers does today | Gap | Effort |
|---|---|---|---|
| Global hotkey (Cmd+T) summons chat from anywhere | No global chat hotkey; `/chat` is a separate route reached via nav | M | S |
| Floating pill at bottom of meeting page is the single handle for transcript + chat | `MeetingChat` lives as a column inside `SessionIntelligenceCanvas`; transcript and chat are separate panels | M | M |
| Contextual quick chips ("What's been discussed?", "Top feature requests?") differ by surface | Same 5 chips (`Sales / Interview / Standup / Follow-up / Intake`) everywhere; `/chat` empty state shows generic chips (`Find decisions`, `Draft follow-up`, `Summarize this week`) | M | S |
| `/` in chat opens Recipes (saved prompt library) | No saved-prompt library; templates are hardcoded in `meeting-chat.tsx` | L | M |
| Inline citations are clickable and seek the transcript | We render `[S{n}]` citations and pass `onCitationClick` through, but it's not wired to the transcript scroll in `SessionIntelligenceCanvas` (verify) | S | S |
| Raw notes ↔ enhanced notes toggle on the meeting page | We show summary + transcript + actions in `SessionIntelligenceCanvas`; no explicit raw/enhanced toggle, and we don't capture user-written in-meeting notes as a first-class artifact | L | L |
| Folder templates that bundle structure + chat prompts + permissions | No folders. No prompt library bound to a workspace | L | L |
| Sample meeting / pre-populated empty state | `app/chat/page.tsx` empty state is generic ("Ask anything from your meeting library"); no sample meeting on first run (unverified — confirm in `app/meetings/`) | M | S |
| Marketing page tone — restrained, single SVG flourish, real testimonials | Layers landing already leans Paper Calm and avoids stock-AI gradient; honest "Built on" bar (recently removed) instead of fake logos. **We're roughly on parity here.** | S | — |
| Handwritten/script accent that signals "your notes" | Audio wave ribbon is our distinctive moment; we don't yet have a "your handwriting" signal anywhere | S | S |
| Notes-pane during meeting: minimal, no AI surface | `app/record/` and live transcript view exist; needs audit for "no AI noise while recording" (unverified) | M | S–M |

---

## 5. Recommendation — top 5 UX changes for Layers

Ranked by impact-to-effort. Biased toward **chat surface** and **templates** per CPO instructions.

### #1 — Promote chat to a persistent surface, not a route

**Change.** Add a floating "Ask Layers" pill fixed to the bottom of the meeting detail page (and eventually every authenticated page). Click expands a sheet with the existing `MeetingChat` UI; Cmd+K (or Cmd+J — pick one, the user's instinct is Cmd+K from Linear/Slack/Superhuman muscle memory) opens it from anywhere.

**Why.** The CPO's stated weakness is "how we have chat, where it is, the ability to use it." A separate `/chat` route forces a context switch. A floating handle on the meeting page makes chat feel like an inseparable part of the artifact, the way Granola's bottom pill does.

**Effort.** S. New `components/floating-ask.tsx` that wraps `MeetingChat` in a sheet (`components/ui/dialog` or a `Sheet` we add); add a global keydown listener at `app/template.tsx` level; replace the inline column variant in `app/meetings/[id]/page.tsx` with the floating handle.

**Files.** `app/template.tsx`, `app/meetings/[id]/page.tsx`, `components/session-workspace.tsx`, new `components/floating-ask.tsx`.

### #2 — Make quick chips context-aware (and rewrite the copy)

**Change.** Replace the static `templates` array in `components/meeting-chat.tsx` and the static chips in `app/chat/page.tsx` with surface-specific prompts that quote the user's data.

- On a meeting page: _"What did we decide?"_ / _"Owner & deadlines"_ / _"Draft a follow-up to {first non-me participant}"_.
- On `/chat` (cross-meeting): _"What did I commit to this week?"_ / _"Recurring blockers"_ / _"Customers asking about pricing"_.
- On an empty state: a literal sample question rendered as if the user just typed it — _"Try: 'What were the decisions in my last 3 meetings?'"_

**Why.** Generic chips ("Find decisions", "Draft follow-up") teach nothing. Granola's chips work because they're written in the user's voice and pull a real value from the surface. This is the cheapest legibility win we have.

**Effort.** S. Strings + a small per-surface lookup.

**Files.** `components/meeting-chat.tsx` (replace `templates`), `app/chat/page.tsx` (replace the inline `signal-chip` array), new `lib/chat/contextual-prompts.ts`.

### #3 — Ship a Recipes library (saved prompts) bound to `/`

**Change.** Two parts. (a) Move the 5 hardcoded templates (`Sales / Interview / Standup / Follow-up / Intake`) into a stored list per user. (b) Wire `/` in the chat input to a typeahead dropdown of those Recipes, plus a few starter Recipes shipped with the product.

**Why.** Templates were specifically called out by the CPO. Granola's `/` is a high-leverage interaction — it makes prompt reuse a system-level habit rather than a copy-paste from somewhere else. It also gives us a place to land "shared team prompts" later without retrofitting.

**Effort.** M. Schema migration (`recipes` table or column on `users`), CRUD in settings, slash menu inside `chat-input.tsx`.

**Files.** `components/chat-input.tsx` (slash trigger + typeahead), `components/meeting-chat.tsx` (replace `templates` import), new `app/settings/recipes/page.tsx`, new `lib/recipes/store.ts`, Supabase migration.

### #4 — Wire citations to seek the transcript, not just render

**Change.** `components/chat-message.tsx` already calls `onCitationClick(segment)`. Confirm the receiver in `SessionIntelligenceCanvas` actually scrolls the transcript pane and highlights the segment; if it doesn't (and a `grep` for `onCitationClick` should answer this in <1 minute), wire it.

**Why.** Citations are the single biggest credibility cue chat answers can give. Granola made "click cite → jump to source" the headline of 2.0. We have the regex parsing and the button rendering already — we're one wire away from parity, possibly already there. This is a quick win to either ship or remove from the gap list.

**Effort.** S. ~30 lines + a visual highlight on the seeked segment.

**Files.** `components/session-workspace.tsx`, `components/meeting-chat.tsx`, possibly `components/live-transcript-view.tsx`.

### #5 — Add a "Notes" mode in the meeting workspace (raw ↔ enhanced)

**Change.** Add a tab or toggle at the top of `SessionIntelligenceCanvas`: **Summary** (current) / **Notes** (new, blank canvas the user can type into during or after the call) / **Transcript** (existing). The Notes view is the user's authored space; the Summary remains the AI-enhanced view. The chat surface knows about both.

**Why.** This is _the_ conceptual move that makes Granola feel different — "your notes, enhanced." Without it, AI summaries feel like something done _to_ the user. With it, the AI is operating on the user's authorship. It's also the foundation for templates having something to enhance (since today our templates run against transcripts, not user notes).

**Effort.** L for the full version (in-call note-taking with sync), M for a post-meeting-only first cut (textarea bound to a `userNotes` field on the meeting). Recommend starting with the post-meeting cut.

**Files.** `components/session-workspace.tsx`, `app/meetings/[id]/page.tsx`, new `components/meeting-notes-editor.tsx`, `lib/meetings/types.ts` (add `userNotes`), Supabase migration.

---

### Honorable mentions (didn't make the top 5)

- Rename "Ask about this meeting" to something with a verb in the second person, e.g. **"Ask"** (Granola does this — minimum-viable label). The current "Ask Layers" workspace heading is fine; the inline-meeting variant "Ask about this meeting" is wordy.
- Add a `Cmd+K` global command palette (search meetings + ask chat + jump to actions). Useful but bigger scope than the top 5.
- Voice activation on the floating Ask pill (Granola added this with the Cmd+T rebuild). Strong on mobile + driving-after-a-call use case. Defer until the floating pill ships.
- Cold-start sample meeting: seed first-time accounts with a pre-recorded sample so `/meetings` is never blank. Cheap if we have any internal recording we can ship; medium if we record one. Not P0 because we're invite-only alpha (per `landing.tsx` comment).

---

## What I could not verify from public sources

- Whether Granola's v2 chat genuinely persists conversations across meeting boundaries (reviewers say "improved" but no official statement found).
- Whether Granola shows a sample meeting at first-run (claimed in some reviews, not in official docs).
- Exact post-Sept-2025 layout of in-meeting chat — `granola.ai/chat` is a marketing page, not the app; specifics about whether chat is now a sidebar vs. a sheet vs. the same pill come from third-party reviews of varying age.
- Whether Layers' `onCitationClick` is actually wired in `SessionIntelligenceCanvas` — flagged as a 2-minute audit in recommendation #4.
- Read.ai's "Ada" — they show it on marketing but did not see an unauthenticated demo.

---

[^granola]: Granola homepage. <https://www.granola.ai>
[^chat]: Granola Chat product page. <https://www.granola.ai/chat>
[^twozero]: "Granola 2.0: A second brain for your team", Granola blog. <https://www.granola.ai/blog/two-dot-zero>
[^updates]: Granola updates feed. <https://www.granola.ai/updates>
[^docs-templates]: "Customize notes with templates", Granola docs. <https://docs.granola.ai/help-center/taking-notes/customise-notes-with-templates>
[^tldv]: tl;dv, "Granola AI Review: My Honest Thoughts After 20+ Meetings (2026)". <https://tldv.io/blog/granola-review/>
[^bluedot]: Bluedot, "In-Depth Granola Review 2026". <https://www.bluedothq.com/blog/granola-review>
[^zack]: Zack Proser, "Granola AI Review: The App I Use Every Meeting". <https://zackproser.com/blog/granola-ai-review>
[^antill]: Anthony Tan, "Granola: The AI Note-Taker with Big Plans". <https://overtheanthill.substack.com/p/granola>
[^medium]: Blanca Serrano Marco, "How Granola AI helped me stop taking notes…", Bootcamp. <https://medium.com/design-bootcamp/how-granola-ai-helped-me-stop-taking-notes-and-start-listening-during-meetings-and-interviews-ff72215b6553>
[^intelligent]: Intelligent Interfaces, "How Granola enhances note-taking with context and user intent". <https://intelligentinterfaces.substack.com/p/how-granola-enhances-note-taking>
[^alt-cmd-t]: AlternativeTo, "Granola adds chat feature with voice activation and CMD+T shortcut" (Oct 2025). <https://alternativeto.net/news/2025/10/granola-adds-chat-feature-with-voice-activation-and-cmd-t-shortcut/>
[^otter]: Otter.ai homepage. <https://otter.ai>
[^ff]: Fireflies.ai homepage. <https://fireflies.ai>
[^tactiq]: Tactiq.io homepage. <https://tactiq.io>
[^read]: Read.ai homepage. <https://read.ai>
