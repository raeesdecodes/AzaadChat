import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — ChatAzad',
  description: 'How ChatAzad collects, uses, stores and deletes data.',
};

export default function PrivacyPage() {
  return (
    <article className="legal">
      <header className="page-head">
        <h1>Privacy Policy</h1>
        <p>Last updated: 30 September 2026</p>
      </header>

      <section className="card">
        <h2>1. Who we are</h2>
        <p>
          ChatAzad is a free, open-source automation tool for Instagram and
          Facebook. It is self-hosted software: you run your own deployment,
          with your own database and your own Meta app. This policy describes
          what data a ChatAzad deployment stores about the people who interact
          with it.
        </p>
      </section>

      <section className="card">
        <h2>2. What data we collect</h2>
        <p>ChatAzad stores only the following:</p>
        <ul>
          <li>
            <strong>Contact records</strong> — the platform (Instagram or
            Facebook), the sender ID issued by Meta, the display name (when
            provided by Meta), the channel last seen on, and counters with
            first/last seen timestamps.
          </li>
          <li>
            <strong>Event logs</strong> — a short text summary of webhook
            events, keyword matches, flow executions, message sends and errors.
            Content is truncated and raw payloads are not stored.
          </li>
          <li>
            <strong>Automation configuration</strong> — the triggers, replies
            and visual flows you create in the dashboard.
          </li>
          <li>
            <strong>Settings</strong> — non-sensitive key/value options such as
            the event retention limit.
          </li>
        </ul>
        <p className="muted small">
          Payment details are not collected: the software is free and
          open-source.
        </p>
      </section>

      <section className="card">
        <h2>3. Where the data comes from</h2>
        <p>
          All interaction data arrives from Meta (Facebook and Instagram)
          webhooks, which deliver events for comments and direct messages on
          the accounts you connect. ChatAzad does not scrape, buy or enrich
          data from any other source, and it does not track people across
          websites.
        </p>
      </section>

      <section className="card">
        <h2>4. How the data is used</h2>
        <ul>
          <li>To deliver the automatic replies and messages you configure.</li>
          <li>To show contacts, activity and statistics in your dashboard.</li>
          <li>To prevent duplicate sends and abuse (for example, one reply per person per post).</li>
          <li>To debug failures using the activity log.</li>
        </ul>
        <p>
          Your data is <strong>never sold, rented or shared with third
          parties</strong> for advertising or any other purpose.
        </p>
      </section>

      <section className="card">
        <h2>5. Data storage and retention</h2>
        <p>
          Data is stored in the Postgres database configured by the deployment
          operator (<code>DATABASE_URL</code>). Event logs are automatically
          pruned to the latest N records on every write (default 200, range
          10–5000), so logs are short-lived by design. Contact records and
          automation configuration are kept until they are deleted.
        </p>
        <p>
          Access tokens are stored encrypted at rest when the operator enables
          token encryption, and are never displayed in the interface.
        </p>
      </section>

      <section className="card">
        <h2>6. Your rights — access and deletion</h2>
        <p>You can request deletion of your data at any time:</p>
        <ul>
          <li>
            <strong>Automatic:</strong> removing the app from your Meta
            account triggers Meta&apos;s data deletion callback, handled at{' '}
            <code>/api/data-deletion</code>, which removes the stored records
            for that account and returns a confirmation code.
          </li>
          <li>
            <strong>Manual:</strong> contact the operator of the deployment you
            used through the{' '}
            <a href="https://github.com/raeesdecodes/AzaadChat">
              ChatAzad GitHub repository
            </a>{' '}
            and include the account or sender ID concerned.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>7. Meta platform</h2>
        <p>
          ChatAzad uses the Meta Graph API under Meta&apos;s own terms. Data
          sent to Meta (replies, messages) is processed by Meta according to
          the Facebook and Instagram terms and privacy policies.
        </p>
      </section>

      <section className="card">
        <h2>8. Changes</h2>
        <p>
          This policy may be updated when the software or the law changes. The
          current version always lives in this page of the deployment.
        </p>
      </section>

      <p className="muted small">
        Questions? Open an issue on the{' '}
        <a href="https://github.com/raeesdecodes/AzaadChat">GitHub repository</a>
        . See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </article>
  );
}
