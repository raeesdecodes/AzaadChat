# chatazad-handoff.md — Session state (resume file)

> **AI instruction:** When the user greets ("hi" / "haan" / "continue"), read this file
> + `chatazad-master-checklist.md`, then reply in Roman Urdu with: Ho gaya / Abhi rukhe the /
> Aaj ka kaam. Then continue ONE task at a time. Last updated: **1 Oct 2026 (raat)**.

---

## A. Project facts
- Repo: `C:\Users\Raees Decodes\Downloads\chatazad-v1\autochat` (branch `master`, push = Vercel deploy)
- Live: `https://azaad-chat.vercel.app` — build gate: `npm run build` (passes ✅)
- Meta app: `social-media-management-handle`, App ID `1560506598564873`
- Page `Raees Decodes` = `1110846448784087`, IG `@raees.decodes`
- User legal name: **`Raees Awan`** (CNIC wala naam), address: `House No 128/A, Muhalla Makka Basti Frontier Colony S.I.T.E, Karachi West, Karachi-75800`, phone `+923160381847`
- Meta helper: **Muse AI** (apna browser hai — login/dedicated Meta clicks ke liye use ho raha hai; use kabhi App Secret/secret na dikhao)
- Vercel env vars set: `DASHBOARD_PASSWORD` (multi), `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN` (**never-expire, 30 Sep ko rotate**), `META_VERIFY_TOKEN`, `DATABASE_URL`

## B. DONE (phases)
- **Phase 0**: codebase scan + spec docs read.
- **Phase 1.1**: `/privacy` + `/terms` LIVE ✅
- **Phase 1.2**: `/api/data-deletion` + `deleteUserData()` LIVE ✅ (tampered sig → 403 tested)
- **Phase 2.1 ✅ COMPLETE (30 Sep 2026)**: leaked token **revoked** (App Access Remove se — `oauth/revoke` ne error 100 diya tha; Muse ne verify: old = #190 invalid), **new never-expire Page token** LIVE on Vercel (`me?fields=id,name` = `{"id":"1110846448784087","name":"Raees Decodes"}` ✅)
- **Phase 2.2**: security audit (signature enforced, no leaks, README env checklist) ✅
- **Phase 2.3**: dashboard password gate (middleware + /login + multi-password) LIVE ✅
- Error logging fix (`graphErrorDetail` shows Meta message in Activity) ✅ — commits: `3380000`, `03e6653`, `718802e`

## C. ABHI RUKHE THE — Phase 1.3 (Business Verification) — MID-FLOW 🔵
**Business Portfolio ban gaya** (ID `1691079359691342`, naam "Raees Decodes"), app connected ✅,
**Start Verification = Eligible/ENABLED** ✅. Form bhar chuke hain:
- Business type: **Sole Proprietorship**
- Business details form: naam/address/phone/ZIP filled; **website field**: `https://raeesdecodes.github.io` **string ACCEPTED** (github.io Meta chala; vercel.app reject hua tha, frii.site band ho gaya tha)
- Lookup fail → **"Upload documents"** flow chal raha hai
- Method: **WhatsApp message** choose karna hai (Email = trap @github.io; code `+923160381847` par)
- Upload screen dikha chuka hai: `Verify legal business name` + dropdown options = **sirf 4**: `Business bank statement` / `Business registration or licence document` / `Business tax document` / `Certificate/articles of incorporation`
- **Decision:** naam verify = **ABBU KI BANK STATEMENT** (faisla: docs abbu ke naam — consent wala, stable; friend wala DROP)
- ⚠️ Business name field abhi `Raees Awan` hai → **ABBU ke naam (CNIC jaisa exact) mein BADALNA HAI**

### Kal (31 Sep 2026) ke steps — inhi se continue karna:
1. Abbu se **bank statement** lo (net-banking PDF ya branch stamped, recent ≤3 mahine, saaf, naam abbu ka)
2. Meta form **Back** → Business name = **abbu ka exact naam** → address = statement wala → Next
3. **WhatsApp method** → OTP abbu ke phone par → daalo
4. Dropdown = **`Business bank statement`** → Upload → Next
5. Agar **address section** aaye → statement/`bijli ka bill` (abbu ke naam, recent)
6. **Submit** → Security Center mein status `In review` → **1–7 din** wait → `Verified`
7. ⚠️ **BONUS zaroori:** `raeesdecodes.github.io` site **LIVE karni hai** (GitHub Pages — steps already given: repo `raeesdecodes.github.io` → index.html with legal name footer → Settings→Pages→main). Meta website check kar sakta hai. (Plan B agar GitHub na chale: netlify.app / hexname)
8. Purane portfolio wali **Page request approve** (Muse ne bheji thi, ID `2028706417647487`)

### Rejection rules (yaad rakhna): naam/address dono match = document se; photo blur/crop/screenshot = reject; free mail = email-verification step par fail.

## D. Uske baad (roadmap)
- **Phase 1.4 App Review**: permissions request — `pages_messaging`, `pages_read_engagement`, `pages_manage_metadata`, `pages_manage_posts`, `instagram_manage_comments`, `instagram_manage_messages` (+ use-case 1-2 lines each), **screencast** (dashboard→trigger→webhook test), Privacy/Terms/Deletion URLs (already LIVE) → Submit. **AI = text/script likhega; user = record + submit.**
- **Phase 1.5**: Advanced Access + app **Live** toggle (user clicks)
- **Phase 1.6 REAL TEST**: non-tester se `raees.decodes` post par keyword comment → Activity: `webhook → trigger_matched → message_sent` → DM. **Ye pass = v1 PUBLIC ready** 🚀
- **Phase 3 (v2 build)**: `chatazad-v2-spec.md` Steps 1–8 → `chatazad-dev-checklist.md` (AI ka kaam — shuru ho chuka hai Step 2 se)

## E. Kaam ka bandobast (AI vs user)
- **AI (is chat):** code/bugfix/features, build+test, git push (user ke kehne par), Vercel deploy (git se), checklist update, exact Meta click-guides, Muse prompts, App Review content, screencast script, v2 build.
- **User:** Meta/Facebook ke clicks + login session, documents (statement/bill/CNIC) + photos upload, WhatsApp OTP, biometric/branch (agar lage), screencast record, real comment test, Muse AI ko browser dena, **har step ka result/screenshot yahan bhejna**.

## F. Workflow (jo chal raha hai)
`AI plan deta → user karta → screenshot/result → AI verify → agla step`. One task at a time.
**1 Oct 2026 raat:** Step 1 auth commit+push (`4a748b5`) — kal Phase 1.3 (bank statement wale din) + v2 Step 3 se continue.

## G. Pending code checklist → `chatazad-dev-checklist.md`
- **Step 2 (lib/crypto.ts) ✅ DONE 30 Sep raat** — AES-256-GCM + `.env.example` + smoke test + build PASS
- **Step 1 (NextAuth auth) ✅ DONE 1 Oct raat** — `/signup` + `/login` email form, JWT sessions, dual middleware gate (legacy `cz_session` fallback), `users` table, store smoke + **HTTP E2E PASS** (login → `/settings` 200; wrong-pass 307)
  - Debug note: Auth.js v5 = cookie `authjs.session-token`, **salt = cookie name** (not `""`); `trustHost: true` zaroori
  - ⚠️ **Vercel mein `AUTH_SECRET` add karna baqi** (`openssl rand -base64 32`)
- Next code: **Step 3 (OAuth connect flow)** — user poochh kar bola hai "continue" toh yahi agla hai
- **Sab kuch COMMIT + PUSH ho chuka hai — `4a748b5` + `53164f5` (master → Vercel auto-deploy)**: AGENTS.md, handoff/checklist docs, auth (auth.ts, middleware, login/signup, [...nextauth]), lib/crypto.ts + smoke scripts, users table, .env.example (AUTH_SECRET + ENCRYPTION_KEY)
- **`AUTH_SECRET` Vercel par SET + LIVE ✅ (1 Oct)** — ab prod email-login kaam karta hai
- **PROD E2E PASS ✅ (1 Oct)**: real signup (multipart form → 303 `/login?created=1`, user prod DB mein) → login (302 + `__Secure-authjs.session-token`) → `/settings`+`/`+`/broadcasts` = **200** session ke saath; bina session/galat password = **307**. Test account: `prod-smoke3@example.com` (throwaway, baad mein hata sakte hain)
- Resume files: `AGENTS.md` (bootstrap), `chatazad-handoff.md` (ye), `chatazad-dev-checklist.md` (code)
