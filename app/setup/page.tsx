'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Step {
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'Create your Meta app',
    body: (
      <>
        <ol>
          <li>
            Go to <code>developers.facebook.com</code> → <strong>My Apps → Create App</strong> (Business type).
          </li>
          <li>
            In the app dashboard click <strong>Add Product</strong> and add{' '}
            <strong>Messenger</strong> and <strong>Instagram</strong>.
          </li>
          <li>
            Make sure your Instagram account is a <strong>business or creator</strong> account
            (not personal) and is linked to your Facebook Page — Page Settings → Linked accounts.
          </li>
        </ol>
        <p>
          While the app is in <strong>development mode</strong>, webhooks only
          fire for users with a role on the app (admin / developer / tester) —
          perfect for testing your own accounts. Public use later needs
          Business Verification + App Review.
        </p>
      </>
    ),
  },
  {
    title: 'Deploy ChatAzad to Vercel',
    body: (
      <>
        <ol>
          <li>Push this project to a GitHub repository.</li>
          <li>
            Vercel → <strong>Add New Project</strong> → import the repo → Deploy.
          </li>
          <li>Note your public URL, e.g. <code>https://chatazad.vercel.app</code>.</li>
        </ol>
        <p>
          Optional but recommended: create a free Postgres database at{' '}
          <code>neon.tech</code> or <code>supabase.com</code> — without{' '}
          <code>DATABASE_URL</code> the app uses local JSON files, which do{' '}
          <strong>not</strong> persist on Vercel.
        </p>
      </>
    ),
  },
  {
    title: 'Configure the webhook in your Meta app',
    body: (
      <>
        <ol>
          <li>Pick a random verify token and save it as <code>META_VERIFY_TOKEN</code> (e.g. run <code>openssl rand -hex 32</code>).</li>
          <li>
            In the app dashboard → <strong>Webhooks</strong> (under the Messenger product):
            <ul>
              <li><strong>Callback URL:</strong> <code>https://YOUR-APP.vercel.app/api/webhook</code></li>
              <li><strong>Verify token:</strong> your <code>META_VERIFY_TOKEN</code> value</li>
              <li>Click <strong>Verify and Save</strong> — Meta calls your endpoint; the app answers the challenge only if the token matches.</li>
            </ul>
          </li>
          <li>
            Subscribe the webhook to your Page, then enable these fields:
            <ul>
              <li><strong>Page:</strong> <code>messages</code>, <code>messaging_postbacks</code>, <code>feed</code></li>
              <li><strong>Instagram:</strong> <code>messages</code>, <code>comments</code></li>
            </ul>
          </li>
        </ol>
      </>
    ),
  },
  {
    title: 'Add your environment variables on Vercel',
    body: (
      <>
        <p>
          Vercel → Project <strong>Settings → Environment Variables</strong>, add:
        </p>
        <ol>
          <li><code>META_VERIFY_TOKEN</code> — must match step 3.</li>
          <li><code>META_PAGE_ACCESS_TOKEN</code> — from Messenger → Messenger API settings → Access Tokens (select your Page and generate).</li>
          <li><code>META_APP_SECRET</code> — from the app&apos;s Settings → Basic (recommended: enables webhook signature verification).</li>
          <li><code>DATABASE_URL</code> — your free Postgres connection string (recommended).</li>
        </ol>
        <p>Redeploy after adding them so they take effect.</p>
      </>
    ),
  },
  {
    title: 'Send a test comment or DM',
    body: (
      <>
        <ol>
          <li>
            In ChatAzad, go to <strong>Quick Replies</strong> and add: keyword{' '}
            <code>LINK</code>, match <em>contains</em>, channel{' '}
            <em>Instagram comment</em>, action <em>Private reply (comment → DM)</em>,
            reply text <code>Here&apos;s your link 🎉</code>.
          </li>
          <li>
            From a <strong>different</strong> account (not the Page/IG admin —
            must have a role on the Meta app while in dev mode), comment{' '}
            <code>LINK</code> on one of your Instagram posts.
          </li>
          <li>Within seconds that account should receive the link as a DM.</li>
          <li>
            Check <strong>Activity</strong> — you should see the{' '}
            <code>webhook</code>, <code>trigger_matched</code> and{' '}
            <code>message_sent</code> events.
          </li>
        </ol>
        <p>
          Working? Now build something bigger in <Link href="/flows">Flows</Link> —
          the visual builder.
        </p>
      </>
    ),
  },
];

const STORAGE_KEY = 'chatazad-setup-done';

export default function SetupPage() {
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as boolean[];
        if (Array.isArray(parsed) && parsed.length === STEPS.length) {
          setDone(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const toggle = (i: number) => {
    const next = done.map((d, idx) => (idx === i ? !d : d));
    setDone(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const doneCount = done.filter(Boolean).length;

  return (
    <div>
      <div className="page-head">
        <h1>Setup wizard</h1>
        <p>
          {doneCount} of {STEPS.length} steps complete — follow these once and
          ChatAzad runs itself.
        </p>
      </div>

      <section className="card">
        <ul className="checklist">
          {STEPS.map((s, i) => (
            <li key={i} className={done[i] ? 'done' : ''}>
              <div className="step-num">{done[i] ? '✓' : i + 1}</div>
              <div className="step-body">
                <h3>{s.title}</h3>
                {s.body}
              </div>
              <button
                className={`step-toggle small ${done[i] ? '' : 'ghost'}`}
                onClick={() => toggle(i)}
              >
                {done[i] ? 'Done ✓' : 'Mark done'}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
