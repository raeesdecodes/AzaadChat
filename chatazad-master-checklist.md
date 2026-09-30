# 🚀 ChatAzad — Master Checklist (Shuru → End Tak)

**Tumhara poora rasta:** v1 publish → v1 secure → v2 build → launch.
Har step pe tag hai:

- 🧑 **TUM** — khud manual karo (Meta dashboard / mobile / Vercel)
- 🤖 **AI AGENT** — Claude Code ya OpenCode mein diya hua prompt paste karo, repo: tumhara existing GitHub repo (v1 wala code)

> ⚠️ AI agents ke liye RULE: naya ZIP/project mat banao. Hamesha **existing repo** mein kaam karo. Pehle `chatazad-v2-spec.md` (repo mein) padho. Har change ke baad `npm run build` pass hona chahiye.

---

## ✅ PHASE 0 — Pipeline Proof (HO GAYA — 30 Sep 2026)

- [x] Webhook live: `https://azaad-chat.vercel.app/api/webhook`
- [x] Meta dashboard ka test event Activity mein aaya (webhook + trigger_matched)
- [x] Matlab: Meta → server → trigger matching = **100% working**

---

## 📢 PHASE 1 — v1 App PUBLISH (taake REAL comments pe auto-DM chale)

**Tumhara sawal:** publish ke baad koi bhi user `LINK` comment karega to auto-reply + auto-DM jayega?
**Jawab:** HAAN! 💯 Live mode + approved permissions ke baad **har public user** ka comment webhook layega → ChatAzad trigger → **DM auto-send**. Koi tester nahi chahiye. Yehi ManyChat ka model hai.

Neeche Meta ki **standard publish requirements** hain (ye fixed hain — har app ke liye yehi checklist hoti hai):

### 1.1 🤖 Privacy Policy + Terms pages banao
**Prompt (Claude Code / OpenCode):**
> `Repo mein do public pages banao: /privacy aur /terms (Next.js App Router). Privacy Policy mein likho: kaunsa data store hota hai (contacts: sender ID + name; events: webhook logs), data Meta webhooks se aata hai, user data-deletion kaise request kare (email + /api/data-deletion endpoint), data kabhi becha nahi jata. Terms mein likho: service self-hosted automation tool hai, user apne Meta app/tokens ka zimmedar hai, acceptable use (spam nahi). Simple, professional English. Build pass karo.`

- [x] Pages live: `azaad-chat.vercel.app/privacy`, `/terms` khul rahe hain ✅ 30 Sep 2026 (tested 200, sidebar-less standalone pages)

### 1.2 🤖 Data Deletion Callback endpoint
Meta App Review iske baghair approve nahi karta.
**Prompt:**
> `POST /api/data-deletion/route.ts banao (Next.js App Router). Meta ka data-deletion request aayega (signed_request). Endpoint: request verify kare, us user ka data (contacts + events, senderId se match) DB se delete kare, aur JSON mein confirmation code + status URL return kare. lib/store.ts mein deleteUserData(senderId) function add karo. Koi secret hard-code mat karo. Build pass karo.`

- [x] Endpoint live, callback URL ready: `https://azaad-chat.vercel.app/api/data-deletion` ✅ (signed_request HMAC verify + confirmation code + `GET ?user_id=` lookup; tampered signature = 403)
- [x] ⚠️ **Vercel mein `META_APP_SECRET` add kiya** ✅ — ab tampered signature par `403 invalid_signature` aa raha hai (pehle 503 tha), matlab signature verification LIVE hai

### 1.3 🧑 Business Verification (Meta dashboard — manual)
- [ ] developers.facebook.com → App Settings → **Business Verification** kholo
- [ ] Business documents do (business license / utility bill / bank statement — naam + address match hona chahiye)
- [ ] Individual ho to individual verification ka option dekho
- [ ] Status **Verified** hone ka wait karo (1–7 din lag sakte hain)

### 1.4 🧑 App Review submit (manual)
- [ ] App Dashboard → **App Review** → permissions request karo:
  - `instagram_manage_comments` (comment read + reply)
  - `instagram_manage_messages` (DM send)
  - `pages_read_engagement`, `pages_manage_posts` (FB side — jo use ho rahe hain)
- [ ] Har permission ke liye **use-case description** likho (1–2 lines: "keyword comment pe auto DM bhejne ke liye")
- [ ] **Screencast video** record karo (2–3 min): ChatAzad dashboard kholo → trigger dikhao → Meta dashboard ka **Test button** dabao → Activity mein webhook + trigger_matched dikhao. (Real comment pre-publish possible nahi — reviewer ye samajhta hai.)
- [ ] Privacy Policy URL, Terms URL, Data Deletion URL teeno fields mein dalo
- [ ] Submit karo, approval ka wait karo (days–weeks)

### 1.5 🧑 Live mode ON
- [ ] Approval ke baad permissions ko **Advanced Access** grant karo
- [ ] Dashboard mein app ko **Live** toggle karo (Publish step complete)
- [ ] Verify: webhooks page pe warning ghayab

### 1.6 🧑 REAL WORLD TEST 🔥
- [ ] **Kisi bhi NON-tester account** se `raees.decodes` ki post pe `LINK` comment karo
- [ ] Activity mein dekho: `webhook` → `trigger_matched` → `message_sent`
- [ ] Commenter ke **DMs** mein link aaya? ✅
- [ ] Agar aaya = **v1 LIVE aur PUBLIC ke liye ready!** 🎉

---

## 🔒 PHASE 2 — v1 Hardening (public se PEHLE zaroor)

### 2.1 🧑 Page Access Token ROTATE karo (ZAROORI!) ✅ DONE (30 Sep 2026)
Chat mein kabhi raw token aaya tha — public launch se pehle badlo:
- [x] Meta dashboard → naya **Page access token** generate kiya — **Never-expire** (user token → extend → `/me/accounts` trick se) ✅
- [x] Vercel → Environment Variables → `META_PAGE_ACCESS_TOKEN` update → **Redeploy** ✅
- [x] Purana (leaked) token revoke — `oauth/revoke` API ne100 diya, isliye **App Access Remove** (`facebook.com/settings/applications` → Remove) se kiya; Muse AI ne verify kiya: **old token = invalid (#190)** ✅
- [x] Final check: `graph.facebook.com/me?fields=id,name` → `{"id":"1110846448784087","name":"Raees Decodes"}` ✅
- Note: App Secret **reset nahi** hua (usse page token marne ki guarantee nahi thi — evidence mixed tha); App bhi delete nahi hua, sirf authorization remove + re-grant hui.

### 2.2 🤖 Security audit
**Prompt:**
> `Repo ka security audit karo: (1) verify karo META_APP_SECRET set hone pe webhook signature (X-Hub-Signature-256) ENFORCE hoti hai — agar nahi to enforce karo; (2) koi bhi API route secret/Token response mein leak to nahi karta; (3) app/api/webhook/route.ts ke neeche wali stale comment ("never awaited") theek karo kyunke processEvents ab awaited hai; (4) Vercel env vars ki checklist banao (DATABASE_URL, META_VERIFY_TOKEN, META_PAGE_ACCESS_TOKEN, META_APP_SECRET, META_APP_ID, META_IG_USER_ID — kaun required, kaun optional) aur README mein likho. Build pass karo.`

- [x] (1) Signature verify code mein enforced hai (`app/api/webhook/route.ts:80`) ✅ — par **chalta tabhi hai jab `META_APP_SECRET` set ho** (Vercel mein abhi set nahi)
- [x] (2) Koi bhi route secret/token response mein nahi bhejta — settings sirf "set/not set" dikhata hai ✅
- [x] (3) Stale "never awaited" comment nahi mila (header already theek hai) ✅
- [x] (4) README mein env-var checklist + legal endpoints table add ki ✅

### 2.3 ➕ Dashboard password gate (naya — public launch se pehle ZAROORI)
Purane code mein koi auth nahi tha: URL jaanta har koi broadcast bhej sakta tha (tumhare Page token se) ya saara data wipe kar sakta tha.
- [x] `middleware.ts` + `lib/auth.ts` + `/login` — env `DASHBOARD_PASSWORD` set karte hi saara dashboard lock ✅
- [x] `/api/webhook`, `/api/data-deletion`, `/privacy`, `/terms` hamesha khule (Meta ko login nahi kar sakta) ✅
- [x] Settings → Security card: password status + Sign out ✅
- [x] ⚠️ **Vercel mein `DASHBOARD_PASSWORD` add kiya** ✅ — `/`, `/settings`, `/flows` ab `307 → /login` redirect ho rahe hain; `/privacy`, `/terms`, `/login`, `/api/*` khule hain

### 2.4 🧑 Facebook side test (optional)
- [ ] FB Page ki post pe comment → auto-reply/DM check

---

## 🌐 PHASE 3 — v2: ManyChat-style Multi-User Version

Spec file: **`chatazad-v2-spec.md`** (repo mein hai — har prompt se pehle agent ko ye padhne ko kaho).
Goal: user aaye → **"Connect Instagram" dabaye** → apna account connect kare → trigger banaye → bas. Koi Vercel/Meta dashboard ka chakkar nahi.

> 🆕 Spec mein **full ManyChat parity** hai: per-post targeting (specific / all / **next post**), keyword include+exclude, **any-comment mode**, **once-per-user-per-post**, **story mention trigger**, reply variations. Tumhara "har post ka alag link" case Section **6b** mein exact example ke saath hai.

### M1 🤖 Auth + user accounts
**Prompt:**
> `chatazad-v2-spec.md padho (Section: Auth). Email/password signup-login banao (NextAuth ya custom JWT — jo stack mein fit ho). users table: id, email, password_hash, created_at. Login ke baghair dashboard ke pages locked hone chahiye. Build pass karo.`

### M2 🤖 Meta OAuth — "Connect Instagram/Facebook" button
**Prompt:**
> `chatazad-v2-spec.md padho (Section: OAuth). "Connect Instagram" aur "Connect Facebook" buttons banao jo Meta OAuth flow chalaye (Facebook Login + Instagram Login). Callback mein: user ke Pages + linked IG accounts auto-discover karo, har account ka access token lo, tokens ko ENCRYPT karke DB mein store karo (AES-256-GCM, key Vercel env TOKEN_ENCRYPTION_KEY se). Kabhi raw token logs ya UI mein mat dikhao. Build pass karo.`

### M3 🤖 Multi-tenant webhook routing
**Prompt:**
> `chatazad-v2-spec.md padho (Section: Webhook routing). /api/webhook ko multi-tenant banao: aane wale event ke Page/IG ID se match karke us OWNER user ka encrypted token nikalo, decrypt karo, aur usi token se reply/DM bhejo. contacts/events tables mein user_id column add karo taake har user ka data alag rahe. Single-tenant mode (env-token fallback) bhi kaam karta rehna chahiye. Build pass karo.`

### M4 🤖 Onboarding UI (ManyChat-simple)
**Prompt:**
> `chatazad-v2-spec.md padho (Section: Onboarding UX). Naye user ke liye 3-step onboarding banao: Step 1 "Connect account" (OAuth buttons), Step 2 "Choose Page/Instagram account" (auto-discovered list), Step 3 "Create your first trigger" (keyword + reply text + action). Har step pe progress dikhe, technical lafz (webhook, token, callback URL) user ko KABHI nazar na aaye. Build pass karo.`

### M5 🤖 Polish + docs
**Prompt:**
> `v2 ke liye: (1) README update karo — user setup ab sirf "Sign up → Connect → Done" hai; (2) per-user usage limits banao (free tier: 1000 DMs/month); (3) data-deletion per-user karo (user delete → uske contacts/events/tokens delete). Build pass karo.`

### M6 🧑 v2 ka Meta App Review (dobara)
- [ ] Central verified app pe naye permissions (agar extra chahiye) ka review
- [ ] Screencast: user signup → connect → comment → DM (poora public flow)
- [ ] Approval → Live

---

## 🎉 PHASE 4 — Launch

- [ ] 🧑 GitHub repo public karo, MIT license add karo
- [ ] 🤖 Landing page copy (AI se likhwao): "Free open-source ManyChat alternative"
- [ ] 🧑 Launch post (Instagram/YouTube — tumhara channel! 🎬)
- [ ] 🧑 Monitor: pehle hafte Activity + Meta Alert Inbox roz check karo

---

## 📌 Quick Reference

| Cheez | Value |
|---|---|
| App | social-media-management-handle (`1560506598564873`) |
| Webhook | `https://azaad-chat.vercel.app/api/webhook` |
| IG account | `@raees.decodes` (`17841427214750302`) |
| Page | Raees Decodes (`1110846448784087`) |
| Spec | `chatazad-v2-spec.md` |

*Last updated: 30 Sep 2026 — Phase 0 complete. Phase 1.1 + 1.2 LIVE & tested. Phase 2.1 COMPLETE (leaked token revoked, never-expire token LIVE on Vercel) + 2.2/2.3 done (dashboard password gate LIVE, META_APP_SECRET signature verification LIVE). Pending on TUM: Business Verification, App Review, Live mode, real comment test. Spec v2 has full ManyChat parity (6b/6c).*
