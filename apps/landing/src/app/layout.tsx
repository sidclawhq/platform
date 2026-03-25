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
    "Identity, policy, human approval, and audit for AI agents. Open-source SDK. FINRA 2026 and EU AI Act compliant. Try the interactive demo.",
  keywords:
    "AI agent governance, AI agent security, AI agent approval, FINRA AI compliance, EU AI Act compliance, agent identity, MCP governance, LangChain security, OpenClaw governance",
  openGraph: {
    title: "SidClaw — The Approval Layer for Agentic AI",
    description:
      "Your agents need identity, policy, and human oversight. Not another IAM — the governance layer that's missing.",
    url: "https://sidclaw.com",
    siteName: "SidClaw",
    type: "website",
    images: [
      {
        url: "https://sidclaw.com/og-image.png",
        width: 2130,
        height: 1069,
        alt: "SidClaw — Identity → Policy → Approval → Trace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SidClaw — The Approval Layer for Agentic AI",
    description:
      "Identity, policy, approval, and audit for AI agents. Open-source SDK.",
    images: ["https://sidclaw.com/og-image.png"],
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
