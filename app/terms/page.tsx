import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — ChatAzad',
  description: 'Terms of use for the ChatAzad automation tool.',
};

export default function TermsPage() {
  return (
    <article className="legal">
      <header className="page-head">
        <h1>Terms of Service</h1>
        <p>Last updated: 30 September 2026</p>
      </header>

      <section className="card">
        <h2>1. What ChatAzad is</h2>
        <p>
          ChatAzad is a free, open-source, self-hosted automation tool for
          Instagram and Facebook. It is provided &quot;as is&quot; under the MIT
          licence. It is not a hosted SaaS service unless a specific operator
          tells you otherwise.
        </p>
      </section>

      <section className="card">
        <h2>2. Your responsibilities</h2>
        <ul>
          <li>
            You are solely responsible for your own Meta app, your own access
            tokens, your own Facebook Page and Instagram account, and for the
            deployment (Vercel, database, domain) you run.
          </li>
          <li>
            You must comply with the Meta Platform Terms, the Instagram Terms
            of Use and all applicable laws in the way you use automation.
          </li>
          <li>
            You are responsible for the content of the messages, replies and
            flows you configure.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>3. Acceptable use</h2>
        <p>You must not use ChatAzad to:</p>
        <ul>
          <li>Send spam, unsolicited or deceptive messages.</li>
          <li>Impersonate another person or brand, or run scams.</li>
          <li>Harvest, resell or unlawfully process personal data.</li>
          <li>Violate Meta&apos;s rules, including its automation and messaging rules.</li>
          <li>Attempt to gain unauthorised access to any system or account.</li>
        </ul>
        <p>
          Automation that annoys or harms people also damages the
          open-source project; keep it respectful.
        </p>
      </section>

      <section className="card">
        <h2>4. Platform constraints</h2>
        <p>
          Meta controls the APIs this tool depends on. Permissions can change,
          apps can be rejected in App Review, and Meta enforces a 24-hour
          messaging window for proactive messages. ChatAzad cannot guarantee
          delivery of any message and is not liable for API changes,
          rejections, suspensions or account actions taken by Meta.
        </p>
      </section>

      <section className="card">
        <h2>5. No warranty and limitation of liability</h2>
        <p>
          The software is provided without warranty of any kind, express or
          implied, including fitness for a particular purpose and
          non-infringement. To the maximum extent permitted by law, the
          authors and contributors are not liable for any claim, damages or
          other liability arising from the use of the software.
        </p>
      </section>

      <section className="card">
        <h2>6. Data</h2>
        <p>
          Use of the software is also governed by our{' '}
          <Link href="/privacy">Privacy Policy</Link>, which explains what
          data is stored and how to request deletion.
        </p>
      </section>

      <section className="card">
        <h2>7. Changes to these terms</h2>
        <p>
          These terms may be updated from time to time. Continued use of the
          software after a change means you accept the updated terms.
        </p>
      </section>

      <p className="muted small">
        Questions? Open an issue on the{' '}
        <a href="https://github.com/raeesdecodes/AzaadChat">GitHub repository</a>.
      </p>
    </article>
  );
}
