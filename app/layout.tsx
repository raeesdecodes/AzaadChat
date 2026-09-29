import type { Metadata } from 'next';
import './globals.css';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: 'ChatAzad — free Instagram & Facebook automation',
  description:
    'Open-source ManyChat alternative: visual flows, keyword triggers, auto-replies and comment-to-DM automation for Instagram and Facebook.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
