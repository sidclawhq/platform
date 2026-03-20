import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans } from "next/font/google";
import "./landing.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Agent Identity & Approval Layer — IAM for AI Agents",
  description:
    "The missing control layer for enterprise AI agents. Identity, authority, policy, approval, and auditable traces for governed AI operations.",
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${instrumentSerif.variable} ${dmSans.variable}`}>
      {children}
    </div>
  );
}
