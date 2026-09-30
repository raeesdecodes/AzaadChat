# AGENTS.md — ChatAzad session bootstrap

## On session start (FIRST user message, e.g. "hi", "haan", "continue")
1. Read `chatazad-handoff.md` (full session state) and `chatazad-master-checklist.md` (roadmap).
2. Reply in **Roman Urdu** with a short resume:
   - "Ho gaya: <done items>" (1-2 lines)
   - "Abhi rukhe the: <exact current step>"
   - "Aaj ka kaam: <next 1-3 steps>"
3. Then wait for the user's go — do ONE task at a time: give exact steps → ask for result/screenshot → next task.

## Project facts (never re-derive)
- Repo: `C:\Users\Raees Decodes\Downloads\chatazad-v1\autochat` (branch `master`, remote `https://github.com/raeesdecodes/AzaadChat.git`)
- Live: `https://azaad-chat.vercel.app` (Vercel auto-deploys on push to master)
- Meta app: `social-media-management-handle`, App ID `1560506598564873`
- Page: `Raees Decodes` = `1110846448784087`; IG: `@raees.decodes`; user legal name = `Raees Awan`
- Build gate: `npm run build` must pass before any commit/push.

## Hard rules
- Language: **Roman Urdu**, kid-level, one task at a time.
- NEVER paste/ask for `META_APP_SECRET` or tokens in any AI chat (including this one). Secrets are rotated locally only.
- Do NOT commit/push unless the user explicitly says to.
- Prefer small verifiable steps; ask for screenshots of Meta UI flows.
- Update `chatazad-handoff.md` whenever phase status changes (done/pending).
