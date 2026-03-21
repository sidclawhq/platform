import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "SidClaw — The Approval Layer for Agentic AI",
  description:
    "Identity, policy, approval, and audit for AI agents. Open-source SDK with enterprise-grade governance.",
  openGraph: {
    title: "SidClaw — The Approval Layer for Agentic AI",
    description:
      "Governance for AI agents. Human oversight for high-risk actions.",
    url: "https://sidclaw.com",
    siteName: "SidClaw",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
