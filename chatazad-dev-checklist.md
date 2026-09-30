# chatazad-dev-checklist.md — v2 code checklist (AI ka kaam)

> Source: `chatazad-v2-spec.md` (Section 5, Steps 1–8) + pending fixes.
> Har step ke baad: `npm run build` pass → user ko demo/screenshot → (commit sirf user ke kehne par).
> Status legend: ☐ pending · 🟡 in progress · ✅ done

## v2 Implementation order (spec Steps)

### ✅ Step 1 — Auth (NextAuth / Auth.js)  ← DONE (1 Oct 2026 raat)
- [x] `next-auth@beta` (v5) + `bcryptjs` (+ `@types/bcryptjs`) add karo
- [x] Credentials provider (email + password), session strategy **JWT**, `pages.signIn = /login`, `trustHost: true`
- [x] Pages: `/signup` (bcrypt 12, dup-email → `?error=exists`) + `/login` (email form + legacy `cz_session` form dono) — purana `DASHBOARD_PASSWORD` gate **rakha fallback ke taur par**
- [x] Middleware: dual gate — legacy `cz_session` **ya** Auth.js JWT (`hasAuthJsSession`); public: `/login`, `/signup`, `/privacy`, `/terms`, `/api/auth/*`
  - ⚠️ Auth.js salt = **cookie name** (`@auth/core`), cookie = `authjs.session-token` (v5) — fix ho chuka hai
- [x] `AUTH_SECRET` `.env.example` mein doc
- [x] DB: `users` table (`db/schema.sql` + `lib/store.ts`: `createUser`/`findUserByEmail`, Postgres + JSON fallback)
- [x] Tests: store smoke ✅ (`scripts/smoke-auth.mts`), HTTP E2E ✅ (login 302 → `/settings` 200, wrong-pass 307, gate 307), `npm run build` PASS
- [x] **PROD LIVE TEST ✅ (1 Oct)**: `AUTH_SECRET` Vercel par set; real signup → login → `/settings` 200; bina session 307 (1 test-account `prod-smoke3@example.com` prod DB mein)

### ✅ Step 2 — Token encryption util (`lib/crypto.ts`)  ← DONE (30 Sep 2026 raat)
- [x] AES-256-GCM `encryptToken(plain)` / `decryptToken(enc)` with `ENCRYPTION_KEY` (32-byte hex)
- [x] `.env.example` mein `ENCRYPTION_KEY` doc + generation command
- [x] Koi bhi decrypted token client ko log/return NAHI (rule — doc comment mein likha)
- [x] Smoke test pass (`scripts/smoke-crypto.mts`: roundtrip + tamper reject + unique IVs) + `npm run build` PASS
- Note: `ENCRYPTION_KEY` Vercel mein tab set karna hai jab token storage ship ho (Step 3/4 ke saath)

### ☐ Step 3 — OAuth connect flow
- [ ] `app/api/oauth/start/route.ts` — Meta dialog URL (scopes: `pages_manage_metadata,pages_read_engagement,pages_messaging,instagram_manage_messages,instagram_manage_comments`), signed `state` cookie
- [ ] `app/api/oauth/callback/route.ts` — state verify → code→short token → long-lived exchange (`fb_exchange_token`) → `GET /me/accounts?fields=id,name,instagram_business_account{id,username},access_token` → encrypt tokens → upsert `connected_accounts` → redirect `/accounts`
- [ ] Env: `APP_URL`

### ☐ Step 4 — Webhook router (modify `app/api/webhook/route.ts`)
- [ ] GET verification + fast-200 POST **as-is** rakho
- [ ] page_id/ig_id → `connected_accounts` lookup → user_id + decrypted token
- [ ] Unknown accounts → log + ignore (no error)
- [ ] `mentions` field support → new channel `instagram_mention` (story mention)
- [ ] Normalizer: `mediaId = change.value.media?.id` (v1 drop karta hai — mandatory for per-post targeting)

### ☐ Step 5 — Engine (`lib/triggers.ts` + flow evaluator)
- [ ] Har query `(user_id, account_id)` scope
- [ ] Per-post targeting: `all` / `specific` (event.mediaId === post_id) / `next` (next_post_cutoff → first fire ke baad flip to specific)
- [ ] Keywords: include list / exclude list / `any_comment`
- [ ] `once_per_user` → `trigger_fires` check+insert
- [ ] Reply variations: `random` | `rotate` (rotate_index persist)
- [ ] Replies = **owner's decrypted Page token** (env token kabhi nahi)

### ☐ Step 6 — Dashboard UI
- [ ] `/accounts` page: Connect Facebook button, list, disconnect
- [ ] Sidebar account switcher (cookie/param) → har page filter
- [ ] Post picker component + `GET /api/media?account_id=` (Graph `/{ig-id}/media`)
- [ ] Trigger/flow editor: replies list (max 10) + variation mode + "Only this post"
- [ ] Onboarding: no accounts → redirect `/accounts` wizard

### ☐ Step 7 — Data deletion (v2 scope)
- [ ] `fb_user_id` column users par (OAuth time store)
- [ ] signed_request verify → user delete (CASCADE) → `{url, confirmation_code}`
- [ ] (v1 wala `/api/data-deletion` already LIVE ✅ — v2 mein user-CASCADE wala upgrade)

### ☐ Step 8 — Privacy/Terms
- [x] `/privacy`, `/terms` LIVE (v1) ✅ — v2: footer + login/signup par link check

## Feature layer (spec Section 6)
- ☐ Comment+DM combo action list (public reply "check DMs 👀" + private link, sequential)
- ☐ Broadcast page par **24-hour window** warning (private replies excepted)
- ☐ Story mention trigger UI hint + story-reply = DM wala note

## Security (non-negotiable)
- ☐ Tokens encrypted at rest (Step 2) · ☐ webhook signature enforced (✅ v1) · ☐ no secrets in client/logs (✅ audit) · ☐ dashboard auth (✅ v1 gate → v2 NextAuth)

## Done already (v1 — carry over)
- ✅ Privacy/Terms pages, data-deletion endpoint, password gate (multi), signature verify, Meta error surfacing, README checklist, token rotate

## Notes
- Spec 6c = ManyChat parity table (source of truth for features)
- Phase 5 (AI replies) = future, not in scope now
- DB migrations: `db/schema.sql` extend karo (users, connected_accounts, alters)
