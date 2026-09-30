# ChatAzad v2 — ManyChat-Style Build Specification

**Goal:** Transform ChatAzad v1 (single-tenant, manual Meta setup per user) into a
ManyChat-like product: a user opens the website, clicks "Connect Facebook /
Instagram", logs in via OAuth, and everything auto-configures. No user ever
touches developers.facebook.com.

**Audience for this doc:** an AI coding assistant (Copilot / Claude Code / OpenCode)
working inside the existing ChatAzad v1 codebase at the repo root. v1 files
referenced below: `app/api/webhook/route.ts`, `lib/meta.ts`, `lib/triggers.ts`,
`lib/store.ts`, `db/schema.sql`, `app/page.tsx` (+ dashboard pages under `app/`).

---

## 1. TL;DR — What changes

| v1 (current) | v2 (target) |
|---|---|
| One deployment = one Meta app, one user | One deployment = many users, one central Meta app |
| User creates Meta app + webhook manually | User clicks "Connect" → Meta OAuth → done |
| Webhook serves one account | Webhook routes events by Page/IG ID → correct user's flows |
| Triggers are global | Triggers/flows are per-user, per-account |
| Keyword → single reply | Keyword → reply variations (random/rotate) + optional per-post targeting |
| Tokens in env vars | Per-user tokens encrypted in DB |

**What does NOT change:** the Meta Graph API client (`lib/meta.ts`), the fast-200
webhook pattern, the keyword matching engine (extended, not replaced), the
dark dashboard theme.

---

## 2. Architecture

```
User browser
   │  "Connect Facebook" (OAuth)
   ▼
Next.js app (Vercel)
   ├─ /api/oauth/start → Meta dialog (scopes)
   ├─ /api/oauth/callback → code→token exchange → store Page token (encrypted)
   │                         + page_id + linked IG id
   ├─ /api/webhook (existing, extended)
   │     Meta event → entry.id (page_id or ig_id)
   │       → lookup connected_accounts → user_id
   │       → run THAT user's flows/triggers only
   └─ Dashboard (per-user): Flows, Quick Replies, Broadcasts, Contacts,
      Activity, Connect/Accounts, Setup — all scoped by session user_id
```

**One central Meta app** (the existing `social-media-management-handle` app, after
it passes App Review — see section 4) serves every user. Its single webhook
callback URL (`https://<app>.vercel.app/api/webhook`) receives events for all
connected Pages/IG accounts.

---

## 3. Prerequisites — Meta side (human work, cannot be coded)

v2 **cannot** work publicly until these are done. In dev mode everything works
only for users with a role on the app.

### 3a. Business Verification
1. Go to `business.facebook.com` → Business Settings → Security Center →
   **Start Verification**.
2. Provide: legal business name, address, phone, website domain. Upload ONE
   official document showing business name + address (business license, tax
   registration, utility bill, bank statement).
3. Verify domain ownership (DNS TXT record or HTML file upload).
4. Wait for Meta approval (typically days).

### 3b. App Review (Permissions and Features)
In the app dashboard → **App Review** → request each permission with a
written justification + screencast:
- `pages_manage_metadata` — "to read the Pages the user administers"
- `pages_read_engagement` — "to read post/comment content for triggers"
- `pages_messaging` — "to send Messenger replies on the user's Page"
- `instagram_manage_messages` — "to send Instagram DMs (auto-replies, private replies)"
- `instagram_manage_comments` — "to read/reply to Instagram comments"

**Screencast must show:** user clicks Connect → grants permissions → creates a
keyword trigger → test comment on IG post → auto-DM arrives. Keep it under
5 minutes, narrate what the app does with each permission.

### 3c. Required URLs (must exist on the deployed site BEFORE review)
- **Privacy Policy** page (e.g. `/privacy`) — required. State what data you
  store (Page tokens encrypted, triggers, minimal event logs) and the
  auto-delete retention policy.
- **Data Deletion Callback** URL (e.g. `/api/data-deletion`) — Meta calls this
  when a user removes the app; implement: look up user by signed request,
  delete their row + all related data, return `{"url": ..., "confirmation_code": ...}`.
- **Terms of Service** page (recommended).

### 3d. Go Live
After approvals: app dashboard → switch app to **Live** mode. Only then can
strangers connect.

---

## 4. Database schema (Postgres)

New tables (extend `db/schema.sql`; keep existing `triggers`/`events` working
or migrate them):

```sql
-- Registered ChatAzad users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,          -- bcrypt
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Each Meta account a user connects via OAuth
CREATE TABLE connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'facebook',  -- 'facebook' covers Page+IG
  page_id TEXT NOT NULL,
  page_name TEXT,
  ig_id TEXT,                          -- linked Instagram business account id
  ig_username TEXT,
  page_token_encrypted TEXT NOT NULL,  -- AES-256-GCM, see section 7
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, page_id)
);

-- Visual flows (extend existing flows table: add user_id, account scoping,
-- post targeting)
ALTER TABLE flows ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE flows ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES connected_accounts(id) ON DELETE CASCADE;
ALTER TABLE flows ADD COLUMN IF NOT EXISTS post_id TEXT;  -- nullable: NULL = all posts

-- Quick replies (extend existing triggers table the same way)
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES connected_accounts(id) ON DELETE CASCADE;
-- Post targeting (ManyChat parity: specific post / all posts / next post)
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS post_target_mode TEXT DEFAULT 'all'; -- 'all' | 'specific' | 'next'
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS post_id TEXT;      -- used when mode='specific'
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS next_post_cutoff TIMESTAMPTZ; -- used when mode='next' (see 5b)
-- Keyword logic (ManyChat parity: include list / exclude list / any comment)
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS keywords_include TEXT[] DEFAULT '{}';
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS keywords_exclude TEXT[] DEFAULT '{}';
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS any_comment BOOLEAN DEFAULT FALSE; -- ignore keywords entirely
-- Anti-spam (ManyChat parity: "only trigger once per user per post")
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS once_per_user BOOLEAN DEFAULT TRUE;
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS replies JSONB;     -- array of strings (variations)
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS variation_mode TEXT DEFAULT 'random'; -- 'random' | 'rotate'
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS rotate_index INT DEFAULT 0;

-- Dedup log for once_per_user (also powers "who already got this" stats)
CREATE TABLE IF NOT EXISTS trigger_fires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT,                       -- NULL for DM triggers
  sender_key TEXT NOT NULL,           -- commenter username/id or DM sender id
  fired_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trigger_id, post_id, sender_key)
);

-- Scope contacts + events per user as well
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES connected_accounts(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
```

---

## 5. Implementation order (for the AI coder)

Do these in order; each is independently testable.

### Step 1 — Auth
- Add `next-auth` v5 (Auth.js) with **Credentials provider** (email + password,
  bcrypt via `bcryptjs`). Session strategy: JWT.
- New pages: `/login`, `/signup`. Protect all dashboard routes with middleware:
  unauthenticated → `/login`.
- New env: `AUTH_SECRET` (generate with `openssl rand -base64 32`).

### Step 2 — Token encryption util (`lib/crypto.ts`)
- AES-256-GCM encrypt/decrypt with `ENCRYPTION_KEY` env (32-byte hex).
- Functions: `encryptToken(plain: string): string`, `decryptToken(enc: string): string`.
- Never log or return decrypted tokens to the client.

### Step 3 — OAuth connect flow
- `app/api/oauth/start/route.ts`: builds Meta dialog URL and redirects:
  `https://www.facebook.com/v21.0/dialog/oauth?client_id={APP_ID}&redirect_uri={APP_URL}/api/oauth/callback&scope={SCOPES}&state={random}&response_type=code`
  Scopes: `pages_manage_metadata,pages_read_engagement,pages_messaging,instagram_manage_messages,instagram_manage_comments`
  Store `state` in a signed cookie for CSRF check.
- `app/api/oauth/callback/route.ts`:
  1. Verify `state`. Exchange `code` → short-lived user token
     (`GET /v21.0/oauth/access_token?...`).
  2. Exchange for long-lived token (`grant_type=fb_exchange_token`, 60 days).
  3. `GET /me/accounts?fields=id,name,instagram_business_account{id,username},access_token`
     with the long-lived token → for EACH page: encrypt `access_token`,
     upsert into `connected_accounts` (page_id, page_name, ig_id, ig_username).
  4. Redirect to `/accounts` (new UI page listing connected accounts).
- New env: `META_APP_ID`, `META_APP_SECRET` (already exists), `APP_URL`
  (e.g. `https://azaad-chat.vercel.app`).

### Step 4 — Webhook router (modify `app/api/webhook/route.ts`)
- Keep GET verification + fast-200 POST pattern exactly as-is.
- After normalizing an event, extract the owner key:
  - Page events: `entry[0].id` = page_id.
  - Instagram events: `entry[0].id` = IG scoped id → match `connected_accounts.ig_id`.
- Look up `connected_accounts` by page_id/ig_id → get `user_id` (+ decrypt token).
- Pass `user_id`, `account_id`, decrypted token into the flow/trigger engine.
- Events for unknown accounts → log + ignore (do not error).
- **Subscribe to the `mentions` webhook field** (Instagram object) and add a new
  trigger channel `instagram_mention`: fires when someone mentions/tags the
  account in their story (ManyChat's "Story Mention" trigger). Normalizer:
  `change.field === 'mentions'` → `senderId = comment:<from>`,
  `mediaId = ''`, text = caption if present else `''` (mentions usually fire on
  `any_comment`-style triggers).
- Story *replies* (someone replies to YOUR story) arrive as normal `messaging`
  DM events — no new channel needed; document this in the trigger editor hint
  text ("Tip: replies to your stories arrive as DMs").

### Step 5 — Engine changes (`lib/triggers.ts`, flow evaluator)
- All trigger/flow queries filtered by `(user_id, account_id)`.
- **Normalizer MUST extract `media_id`:** extend `app/api/webhook/route.ts`
  `normalizePayload` so every comment event carries
  `mediaId = String(change.value.media?.id ?? '')` (v1 currently drops this —
  without it per-post targeting cannot work).
- **Per-post targeting** (trigger fields `post_target_mode`, `post_id`,
  `next_post_cutoff`):
  - `all` → fires on any post (v1 behavior).
  - `specific` → fires only when `event.mediaId === trigger.post_id`.
  - `next` → fires only on the first post published AFTER the trigger went
    live: at trigger creation set `next_post_cutoff = now()`; on a comment,
    fetch the media's timestamp (or compare against the newest media id seen
    at creation) and fire only if the media is newer than the cutoff. After
    the first fire, store that `media_id` into `post_id` and flip mode to
    `specific` (so it keeps working for that post only, exactly like ManyChat).
- **Keyword logic** (`keywords_include[]`, `keywords_exclude[]`, `any_comment`):
  - `any_comment = true` → keyword check skipped (any comment fires).
  - Otherwise the comment must match ≥1 include keyword (match types:
    exact/contains/starts_with, case-insensitive — v1 engine, extended to a list)
    AND must NOT match any exclude keyword.
  - DM triggers keep single-keyword behavior (include list with 1 entry).
- **Once per user per post** (`once_per_user`, default TRUE): before firing,
  check `trigger_fires` for `(trigger_id, post_id, sender_key)`; if present,
  skip. After firing, insert the row. (ManyChat's "only trigger once per user
  per post" — stops the same person getting 5 DMs for 5 comments.)
- **Reply variations:** trigger/flow stores `replies[]`. On fire:
  - `random` → pick uniformly at random.
  - `rotate` → use `rotate_index`, then increment (wrap around), persisted.
- Replies execute with the **account owner's decrypted Page token**, never env.

### Step 6 — Dashboard UI changes
- **Accounts page** (`/accounts`): "Connect Facebook" button, list of connected
  Pages/IG accounts, disconnect (deletes row + tokens).
- **Sidebar account switcher:** when a user has multiple connected accounts,
  every page (Flows, Quick Replies, Broadcasts, Contacts, Activity) filters by
  the selected `account_id` (store in a cookie or URL param).
- **Post picker:** new component used in flow/trigger editors. Calls new API
  `GET /api/media?account_id=...` → Graph `/{ig-id}/media?fields=id,caption,media_type,thumbnail_url,timestamp,permalink&limit=25`
  → grid UI to pick "All posts" or one specific post (saves `post_id`).
- **Trigger/flow editor:** replies become a list (add/remove up to 10), with
  variation mode select (Random / Rotate). Flow builder Trigger node gets an
  optional "Only this post" field using the post picker.
- **Onboarding:** first login with no accounts → redirect to `/accounts` with a
  friendly "Connect your Facebook Page to start" wizard.

### Step 7 — Data Deletion endpoint (`app/api/data-deletion/route.ts`)
- Verify Meta's `signed_request`, find user by FB user id (store `fb_user_id`
  on users at OAuth time — add the column), delete user row (CASCADE handles
  the rest), return `{url, confirmation_code}` JSON.

### Step 8 — Privacy/Terms pages (`/privacy`, `/terms`)
- Plain-language pages (see 3c). Link them in the footer + login/signup pages.

---

## 6. Reply variations + comment/DM combos (feature spec)

A trigger/flow may now contain an ordered action list, e.g.:
1. `comment_reply` — public reply under the user's comment (pick from variations).
2. `private_reply` — DM with the link (pick from variations).

Engine executes actions sequentially with the owner's token. This reproduces the
viral ManyChat pattern: public "check your DMs 👀" + private link delivery.

**Platform constraint (must surface in UI):** Meta's 24-hour messaging window —
a Page/IG business account can only proactively message someone within 24h of
their last message, EXCEPT **private replies to comments**, which are always
allowed. The UI should note this on the Broadcast page (broadcasts only reach
contacts active in the last 24h).

## 6b. Per-post targeting — the exact use case ("har post ka alag link")

**Problem:** one global "LINK → reply" trigger sends the SAME link even when
someone comments on an old post that advertised a different link.

**Solution (ManyChat-style):** create ONE trigger PER post, each scoped to its
post with its own reply text:

| Trigger | Post targeting | Keyword | DM reply |
|---|---|---|---|
| Trigger 1 | `specific` → Post A (reel about course) | LINK | course wala link |
| Trigger 2 | `specific` → Post B (reel about ebook) | LINK | ebook wala link |

Engine logic (from Step 5): comment arrives → normalizer extracts `mediaId` →
only the trigger whose `post_id === mediaId` fires → commenter gets THAT post's
link. Comment on Post A can never receive Post B's link. ✅

**UI:** the trigger editor's post picker (Step 6) offers three modes, exactly
like ManyChat:
1. **All posts** — fires everywhere (v1 behavior).
2. **Specific post** — grid picker, choose the post/reel.
3. **Next post** — arms on the next post you publish (for "comment LINK on my
   NEW reel" CTAs without rebuilding the trigger each time).

**"User kuch bhi comment kare to DM jaye?"** — Yes: set `any_comment = true`
on the trigger (ManyChat's "Any comment" option). Combine with
`keywords_exclude` to skip spam words.

## 6c. ManyChat feature parity checklist

| ManyChat feature | ChatAzad v2 status |
|---|---|
| Comment trigger: specific post | ✅ (6b) |
| Comment trigger: all posts | ✅ (v1 behavior) |
| Comment trigger: **next post** | ✅ added (Step 5) |
| Keyword include list | ✅ added (Step 5) |
| Keyword **exclude** list | ✅ added (Step 5) |
| **Any comment** mode | ✅ added (Step 5) |
| Public reply variations (random/rotate) | ✅ (Section 6) |
| Private reply DM (comment → DM) | ✅ (v1) |
| **Once per user per post** | ✅ added (Step 5, `trigger_fires`) |
| **Story mention** trigger | ✅ added (Step 4, `instagram_mention`) |
| Story reply (arrives as DM) | ✅ documented (Step 4) |
| Keyword match types (exact/contains/starts_with) | ✅ (v1) |
| DM keyword triggers (IG + Messenger) | ✅ (v1) |
| Broadcasts | ✅ (v1) |
| Visual flow builder | ✅ (v1) |
| AI replies / AI flow builder | 🔮 future (Phase 5) — needs an LLM key per user; not core |
| Giveaway/contest mode | 🔮 future — can be built on once_per_user + flows |

---

## 7. Security notes (non-negotiable)

- Page tokens encrypted at rest (AES-256-GCM, `ENCRYPTION_KEY`).
- Never send tokens to the browser; API routes decrypt server-side only.
- Webhook signature verification stays on (`META_APP_SECRET`).
- OAuth `state` CSRF check on callback.
- Rate-limit the webhook route implicitly by keeping it fast; add per-account
  daily send caps (e.g. env `DAILY_SEND_CAP=1000`) to contain abuse.

---

## 8. Testing checklist (v2)

1. Sign up → redirected to Connect → OAuth → Page+IG appear in Accounts.
2. Create trigger (keyword LINK, this-post-only, 3 reply variations, rotate).
3. Comment LINK from a second account → public variation reply + DM link arrive.
4. Comment again → next variation in rotation.
5. **Per-post isolation:** trigger 1 (Post A, link X) + trigger 2 (Post B, link Y)
   → comment LINK on Post A → DM contains link X only; comment on Post B →
   link Y only.
6. **Once per user:** same user comments twice on Post A → only ONE DM.
7. **Exclusions:** comment "LINK scam" with `scam` in exclude list → no DM.
8. **Any-comment mode:** trigger with `any_comment=true` → comment "nice video"
   → DM fires.
9. **Next-post mode:** create trigger in `next` mode → publish a new reel →
   comment on it → fires; old posts → don't fire.
10. **Story mention:** mention the account in a story → `instagram_mention`
    trigger fires → DM sent.
11. Disconnect account → triggers stop firing; data deleted.
12. Second user signs up → cannot see first user's flows/accounts (isolation).
13. Data-deletion endpoint returns proper confirmation JSON.

---

## 9. Honest costs & limits (read before building)

- **Build effort:** this is a 2–4 week project with AI assistance (auth, OAuth,
  multi-tenancy, UI). Not a weekend task.
- **Meta approval:** Business Verification + App Review can take days–weeks and
  CAN be rejected (common first-try rejections: weak screencast, missing privacy
  policy). Budget for 2–3 submission rounds.
- **Hosting (central model):** one Vercel deployment serves ALL users.
  - Hobby (free): fine for tens of active users; webhook traffic + dashboard use
    counts against execution/bandwidth limits.
  - Expect to need Vercel Pro (~$20/mo) past that; database on Neon scales free
    surprisingly far IF the retention policy (auto-prune events) is kept.
  - Open-source self-hosters bear their own cost (n8n model) — keep the
    single-tenant env-var mode working as a fallback.
- **Platform risk:** Meta can change API rules, pricing, or messaging windows at
  any time. ManyChat lives with this; so would you.
- **What stays free forever:** the code (MIT), self-hosting path.

## 10. Build / don't-build decision guide

**Build v2 if:** you want a real public product; you're willing to do Business
Verification + App Review paperwork; you accept ~$20+/mo hosting once it grows;
you want the ManyChat-like onboarding as the differentiator.

**Don't build v2 if:** you only need automation for your own channels (v1
already does this); you won't do Meta's paperwork; you want zero hosting cost
(the central model always costs the host something at scale).

**Middle path:** ship v1 for yourself now, open-source it, and build v2 only
after v1 proves the engine on your own audience.
