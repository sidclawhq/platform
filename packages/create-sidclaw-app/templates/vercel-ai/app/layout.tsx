import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '{{projectName}}',
  description: 'A governed AI agent powered by SidClaw',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
