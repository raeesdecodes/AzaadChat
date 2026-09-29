# ChatAzad

**ChatAzad** is a free, open-source, ManyChat-style automation app for
Instagram and Facebook — visual flow builder, keyword quick replies, comment
→ DM private replies, broadcasts, contacts, and a live activity log.

Self-host it on the **Vercel free tier** (or anywhere you can run Next.js)
with a **free Postgres** database (Neon / Supabase). It is 100% yours: your
data, your Meta app, your server — no SaaS fees, no subscriber limits.

> Status: open-source MVP. MIT licensed. Contributions welcome.

---

## ✨ Features

- **🎛 Visual flow builder** — drag-and-drop canvas (React Flow) with Trigger,
  Send Message, Private Reply, and Condition nodes. Flows are evaluated
  **before** legacy keyword triggers.
- **⚡ Quick replies** — simple keyword → reply automations (exact / contains /
  starts-with) across Instagram DMs, Instagram comments, Facebook messages and
  Facebook comments. The classic *comment “LINK” → get the link in DM* flow.
- **📣 Broadcasts** — message all DM contacts at once, with a per-recipient
  log and a visible warning about Meta's 24-hour messaging window.
- **👥 Contacts** — every unique sender captured automatically from webhooks,
  with search.
- **📡 Activity log** — every webhook, match, send and error in one place.
  The log **auto-prunes to the latest N events** (default 200, configurable in
  Settings) inside the write path, so your database never grows on the free tier.
- **🧭 Setup wizard** — a 5-step checklist that walks you from Meta app
  creation to your first live test.
- **🛠 Settings** — webhook URL derivation, env-var health checklist,
  retention control, and a clear-all danger zone.
- **🎨 Polished dark UI** — collapsible sidebar, cards, stats, tables and
  responsive layouts.

## 🏗 Architecture

- **Next.js 14 App Router**, strict TypeScript, no new UI deps (React Flow
  only).
- **Meta webhooks** (`app/api/webhook/route.ts`):
  - `GET` verifies the hub challenge against `META_VERIFY_TOKEN`.
  - `POST` verifies `X-Hub-Signature-256` when `META_APP_SECRET` is set,
    captures contacts, runs the first matching flow, falls back to quick
    replies, logs everything — and always answers fast (`EVENT_RECEIVED`).
- **Automation engine**:
  - `lib/flows.ts` — flow graph evaluation: trigger → sequential steps,
    condition branching (true/false handles), 25-step loop guard.
  - `lib/triggers.ts` — legacy keyword quick replies.
  - `lib/meta.ts` — Meta Graph API calls (IG DM, FB message, comment reply,
    comment → DM private reply).
- **Storage** (`lib/store.ts`) — Postgres when `DATABASE_URL` is set (tables:
  `triggers`, `flows`, `contacts`, `events`, `settings` — see `db/schema.sql`);
  local JSON files otherwise (dev only). Event pruning happens inside the
  write path with a configurable limit (default 200, clamped 10–5000).
- **UI** — pages under `app/` + `components/Shell.tsx` layout with collapsible
  sidebar; `@xyflow/react` powers the flow canvas.

## 🚀 Quick start (local)

```bash
npm install
cp .env.example .env   # fill in META_VERIFY_TOKEN etc.
npm run dev            # http://localhost:3000
```

Use something like [ngrok](https://ngrok.com) to expose your local webhook to
Meta while developing.

## ☁️ Deploy to Vercel (free tier)

1. Push this repo to GitHub, import it in Vercel, and deploy.
2. Create a free Postgres DB at [neon.tech](https://neon.tech) or
   [supabase.com](https://supabase.com) and paste its connection string as
   `DATABASE_URL` in Vercel → Project Settings → Environment Variables.
3. Open the deployed **Setup** page in ChatAzad and follow the wizard:
   Meta app creation → webhook configuration → env vars → live test.

The app is n8n-style self-hosted: **each deploy uses its own Vercel project,
database and Meta app**, so there's no shared backend to outgrow.

## 📨 Meta setup summary

- Create a Business-type app at `developers.facebook.com`, add the
  **Messenger** and **Instagram** products.
- Your Instagram account must be a **business/creator** account linked to
  your Facebook Page.
- Webhook Callback URL: `https://YOUR-APP.vercel.app/api/webhook`
  (Settings → Webhook shows the derived URL).
- Subscribe: Page → `messages`, `messaging_postbacks`, `feed`;
  Instagram → `messages`, `comments`.
- In dev mode, webhooks fire only for app roles (admin/developer/tester) —
  use a second test account for end-to-end testing.

> ⚠️ **24-hour messaging window:** standard messages can only reach people
> who messaged you in the last 24 hours. Broadcasts outside that window fail
> per-recipient; failures are logged, not retried.

## 🗄 Data retention

Events auto-prune to the latest **N** records on every write
(`Settings → Data retention`, default 200, range 10–5000). Contacts and flow
definitions are kept indefinitely. `clearAll()` in the danger zone wipes
everything.

## 🗺 Roadmap

- Sequenced/delayed steps and follow-up DMs
- Media attachments (images, quick replies buttons)
- Segmentation & tagging for broadcasts
- Template-message support for the 24h window
- E2E tests, Docker self-host image

## 🤝 Contributing

Issues and PRs are welcome — it's an MVP, so even small fixes help.

## 📄 License

MIT — see [LICENSE](LICENSE). Do whatever you want with it.
