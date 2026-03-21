import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SidClaw Governed AI Assistant',
  description: 'Chat assistant with governed tools powered by SidClaw',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0A0A0B] text-[#E4E4E7] antialiased">{children}</body>
    </html>
  );
}
