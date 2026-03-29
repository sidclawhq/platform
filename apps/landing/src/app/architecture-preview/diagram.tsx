"use client";

/* ═══════════════════════════════════════════════════════════════════ */
/*  Product-in-context diagram — enhanced with personas & logos      */
/*  Pure HTML/CSS/SVG — no library dependencies                      */
/* ═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect } from "react";
import { Check, User, Shield, Eye } from "lucide-react";

/* ── Colors ── */
const C = {
  bg: "#0A0A0B",
  surface: "#111113",
  surface2: "#1A1A1D",
  border: "#27272A",
  borderSubtle: "rgba(255,255,255,0.05)",
  text: "#E4E4E7",
  muted: "#A1A1AA",
  dim: "#71717A",
  blue: "#3B82F6",
  indigo: "#6366F1",
  amber: "#F59E0B",
  green: "#22C55E",
  red: "#EF4444",
};

/* ═══════════════════════════════════════════════════════════════════ */
/*  PERSONA BADGE                                                    */
/* ═══════════════════════════════════════════════════════════════════ */

function Persona({ icon: Icon, label, sublabel }: {
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  label: string;
  sublabel: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{
        width: 32, height: 32, minWidth: 32, minHeight: 32, borderRadius: "50%",
        background: C.surface2, border: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon style={{ width: 14, height: 14, color: C.muted }} />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{label}</div>
        <div style={{ fontSize: 10, color: C.dim }}>{sublabel}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  CENTER: Dashboard approval card                                  */
/* ═══════════════════════════════════════════════════════════════════ */

function ApprovalCard() {
  const [step, setStep] = useState(2);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 4), 3000);
    return () => clearInterval(t);
  }, []);

  const steps = ["Identity", "Policy", "Approval", "Trace"];
  const stepColors = [C.indigo, C.blue, C.amber, C.green];

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      overflow: "hidden",
      width: "100%",
      maxWidth: 420,
      position: "relative",
    }}>
      {/* Glow effect behind card */}
      <div style={{
        position: "absolute", inset: -1, borderRadius: 12,
        background: `linear-gradient(135deg, ${C.blue}15, ${C.amber}10, ${C.green}08)`,
        zIndex: -1, filter: "blur(30px)",
      }} />

      {/* Header bar with product pillars */}
      <div style={{
        padding: "10px 14px",
        borderBottom: `1px solid ${C.border}`,
        background: `linear-gradient(180deg, ${C.surface2}, ${C.surface})`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Shield style={{ width: 14, height: 14, color: C.blue }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>SidClaw</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {steps.map((s, i) => (
            <div key={s} style={{
              padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 600,
              background: i === step ? `${stepColors[i]}20` : "transparent",
              color: i <= step ? stepColors[i] : C.dim,
              border: i === step ? `1px solid ${stepColors[i]}30` : "1px solid transparent",
              transition: "all 0.4s",
            }}>
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Window chrome */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 14px", borderBottom: `1px solid ${C.border}`, background: C.bg,
      }}>
        <div style={{ display: "flex", gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: `${C.red}35` }} />
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: `${C.amber}35` }} />
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: `${C.green}35` }} />
        </div>
        <span style={{ fontSize: 9, color: C.dim, fontFamily: "monospace" }}>app.sidclaw.com/approvals</span>
        <div style={{ width: 40 }} />
      </div>

      {/* Card body */}
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Approval Required</div>
            <div style={{ fontSize: 9, color: C.dim, fontFamily: "monospace", marginTop: 2 }}>apr_x7k9m2 · 12s ago</div>
          </div>
          <span style={{
            fontSize: 8, fontWeight: 700, fontFamily: "monospace", padding: "3px 7px", borderRadius: 4,
            background: `${C.amber}15`, color: C.amber, border: `1px solid ${C.amber}25`,
            textTransform: "uppercase", letterSpacing: "0.1em",
          }}>High Risk</span>
        </div>

        <div style={{ background: C.bg, border: `1px solid ${C.borderSubtle}`, borderRadius: 6, padding: 10, marginBottom: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 14px" }}>
            {[
              { l: "Agent", v: "customer_support" },
              { l: "Operation", v: "send_email" },
              { l: "Target", v: "email_service" },
              { l: "Classification", v: "confidential", c: C.amber },
            ].map((r) => (
              <div key={r.l}>
                <div style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 1 }}>{r.l}</div>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: r.c ?? C.text }}>{r.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            padding: "7px 0", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "default",
            background: `${C.green}12`, border: `1px solid ${C.green}25`, color: C.green,
          }}>
            <Check style={{ width: 11, height: 11 }} /> Approve
          </button>
          <button style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            padding: "7px 0", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "default",
            background: `${C.red}12`, border: `1px solid ${C.red}25`, color: C.red,
          }}>
            ✕ Deny
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, borderTop: `1px solid ${C.borderSubtle}` }}>
          <span style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Trace</span>
          <code style={{ fontSize: 9, fontFamily: "monospace", color: C.muted }}>tr_a1b2c3d4e5f6</code>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  LEFT: SDK code snippet + framework logos                         */
/* ═══════════════════════════════════════════════════════════════════ */

const FRAMEWORK_LOGOS = [
  { name: "LangChain", src: "/logos/langchain-icon.png" },
  { name: "OpenAI", src: "/logos/openai-icon.png" },
  { name: "Vercel AI", src: "/logos/vercel-icon.png" },
  { name: "MCP", src: "/logos/mcp-icon.png" },
  { name: "CrewAI", src: "/logos/crewai.webp" },
  { name: "Claude", src: "/logos/claude-icon.png" },
];

function SDKPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 280 }}>
      <Persona icon={User} label="Developer" sublabel="Integrates SDK in agent code" />

      {/* OpenClaw featured callout */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "10px 14px", marginBottom: 10,
        background: `linear-gradient(135deg, ${C.amber}08, ${C.amber}04)`,
        border: `1px solid ${C.amber}25`,
        borderRadius: 10,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/openclaw.png" alt="OpenClaw" style={{ width: 36, height: 36, objectFit: "contain" }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>OpenClaw</span>
            <span style={{
              fontSize: 8, fontWeight: 600, padding: "2px 6px", borderRadius: 10,
              background: `${C.amber}15`, color: C.amber, border: `1px solid ${C.amber}20`,
              fontFamily: "monospace",
            }}>250K+ stars</span>
          </div>
          <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>
            Govern any OpenClaw skill with SidClaw
          </div>
        </div>
      </div>

      {/* Code snippet */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
        overflow: "hidden", width: "100%",
      }}>
        <div style={{
          padding: "5px 12px", borderBottom: `1px solid ${C.border}`, background: C.bg,
          fontSize: 10, color: C.dim, fontFamily: "monospace",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>your-agent.ts</span>
          <span style={{ fontSize: 8, color: C.blue }}>TypeScript</span>
        </div>
        <pre style={{
          padding: 12, margin: 0, fontSize: 11, lineHeight: 1.6, fontFamily: "monospace",
          color: C.muted, overflow: "hidden",
        }}>
          <span style={{ color: "#C084FC" }}>const</span>{" "}
          <span style={{ color: C.text }}>result</span>{" "}
          <span style={{ color: C.dim }}>=</span>{" "}
          <span style={{ color: "#C084FC" }}>await</span>{"\n"}
          {"  "}client.<span style={{ color: C.blue }}>evaluate</span>
          <span style={{ color: C.text }}>({"{"}</span>{"\n"}
          {"    "}<span style={{ color: C.blue }}>operation</span>
          <span style={{ color: C.dim }}>:</span>{" "}
          <span style={{ color: "#34D399" }}>&apos;send_email&apos;</span>
          <span style={{ color: C.dim }}>,</span>{"\n"}
          {"    "}<span style={{ color: C.blue }}>target</span>
          <span style={{ color: C.dim }}>:</span>{" "}
          <span style={{ color: "#34D399" }}>&apos;email_service&apos;</span>
          <span style={{ color: C.dim }}>,</span>{"\n"}
          {"    "}<span style={{ color: C.blue }}>classification</span>
          <span style={{ color: C.dim }}>:</span>{" "}
          <span style={{ color: "#34D399" }}>&apos;confidential&apos;</span>{"\n"}
          {"  "}<span style={{ color: C.text }}>{"}"});</span>
        </pre>
      </div>

      {/* Framework logos */}
      <div style={{ marginTop: 12, width: "100%" }}>
        <div style={{ fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, textAlign: "center" }}>
          Also works with
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
          {FRAMEWORK_LOGOS.map((fw) => (
            <div key={fw.name} style={{
              width: 36, height: 36, borderRadius: 6,
              background: C.surface, border: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 6,
            }} title={fw.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fw.src} alt={fw.name} style={{ width: 20, height: 20, objectFit: "contain" }} />
            </div>
          ))}
          <div style={{
            height: 36, borderRadius: 6, padding: "0 10px",
            background: "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, color: C.dim,
          }}>
            +9 more
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  RIGHT: Notification cards                                        */
/* ═══════════════════════════════════════════════════════════════════ */

function ReviewerPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 240, maxWidth: 260 }}>
      <Persona icon={Eye} label="Reviewer" sublabel="Approves or denies actions" />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        {[
          { channel: "Slack", icon: "/logos/slack-icon.png", msg: "#approvals" },
          { channel: "Teams", icon: "/logos/teams-icon.png", msg: "Adaptive Card" },
          { channel: "Telegram", icon: "/logos/telegram-icon.png", msg: "@sidclaw_bot" },
        ].map((n) => (
          <div key={n.channel} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={n.icon} alt={n.channel} style={{ width: 22, height: 22, objectFit: "contain", flexShrink: 0 }} />
            <div style={{ whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{n.channel}</div>
              <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>{n.msg}</div>
            </div>
          </div>
        ))}
        {/* Email row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        }}>
          <div style={{
            width: 22, height: 22, minWidth: 22, borderRadius: 4,
            background: C.surface2, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, flexShrink: 0,
          }}>✉️</div>
          <div style={{ whiteSpace: "nowrap" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Email</div>
            <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>via Resend</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  BOTTOM: Audit trace                                              */
/* ═══════════════════════════════════════════════════════════════════ */

function TracePanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 680 }}>
      <Persona icon={Shield} label="Compliance Officer" sublabel="Reviews tamper-evident audit trail" />
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
        overflow: "hidden", width: "100%",
      }}>
        <div style={{
          padding: "5px 12px", borderBottom: `1px solid ${C.border}`, background: C.bg,
          fontSize: 10, color: C.dim, fontFamily: "monospace",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>Audit Trail</span>
          <span style={{ fontSize: 8, color: C.green }}>hash-chain verified</span>
        </div>
        <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{
            fontSize: 8, fontWeight: 700, padding: "3px 8px", borderRadius: 4,
            background: `${C.green}12`, color: C.green, border: `1px solid ${C.green}25`,
            textTransform: "uppercase", letterSpacing: "0.1em",
          }}>Approved</div>
          <code style={{ fontSize: 10, color: C.blue, fontFamily: "monospace" }}>tr_a1b2c3d4e5f6</code>
          <span style={{ fontSize: 10, color: C.dim }}>agent: <span style={{ color: C.muted }}>customer_support</span></span>
          <span style={{ fontSize: 10, color: C.dim }}>op: <span style={{ color: C.muted }}>send_email</span></span>
          <span style={{ fontSize: 10, color: C.dim }}>policy: <span style={{ color: C.blue }}>email-governance v3</span></span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.green }} />
            <span style={{ fontSize: 9, color: C.dim, fontFamily: "monospace" }}>sha256:e4f2…</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  CONNECTOR ARROWS                                                 */
/* ═══════════════════════════════════════════════════════════════════ */

function HArrow({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 6px", minWidth: 70 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>{label}</span>
      <svg width="70" height="12" viewBox="0 0 70 12">
        <line x1="0" y1="6" x2="58" y2="6" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
        <polygon points="58,2 66,6 58,10" fill={color} />
      </svg>
    </div>
  );
}

function VArrow({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
      <svg width="12" height="28" viewBox="0 0 12 28">
        <line x1="6" y1="0" x2="6" y2="20" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
        <polygon points="3,20 6,27 9,20" fill={color} />
      </svg>
      <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  CONTEXT DIAGRAM (enhanced)                                       */
/* ═══════════════════════════════════════════════════════════════════ */

export function ContextDiagram() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      {/* Main row — top-aligned so persona badges match card top */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 0 }}>
        {/* Left: Developer + SDK */}
        <SDKPanel />

        {/* Arrow: SDK → SidClaw — vertically centered against card */}
        <div style={{ paddingTop: 160 }}>
          <HArrow label="evaluate" color={C.blue} />
        </div>

        {/* Center: SidClaw */}
        <ApprovalCard />

        {/* Arrow: SidClaw → Reviewers */}
        <div style={{ paddingTop: 160 }}>
          <HArrow label="notify" color={C.amber} />
        </div>

        {/* Right: Reviewer + Notifications */}
        <ReviewerPanel />
      </div>

      {/* Down arrow */}
      <VArrow label="record" color={C.green} />

      {/* Bottom: Compliance + Trace */}
      <TracePanel />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  SIMPLIFIED PIPELINE                                              */
/* ═══════════════════════════════════════════════════════════════════ */

const STEPS = [
  { id: "agent", label: "AI Agent", sub: "requests action", color: { main: C.dim, bg: C.surface } },
  { id: "identity", label: "Identity", sub: "Who is this?", color: { main: C.indigo, bg: "#1E1B4B" } },
  { id: "policy", label: "Policy", sub: "What can it do?", color: { main: C.blue, bg: "#172554" } },
  { id: "approval", label: "Approval", sub: "Should we allow it?", color: { main: C.amber, bg: "#451A03" } },
  { id: "trace", label: "Trace", sub: "What happened?", color: { main: C.green, bg: "#052E16" } },
];
const EDGE_LABELS = ["register", "evaluate", "review", "record"];

function SimplifiedDiagram() {
  return (
    <div style={{ padding: "40px 0", overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, minWidth: 800 }}>
        {STEPS.map((step, i) => (
          <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              width: 140, padding: "16px 12px", borderRadius: 10,
              background: step.color.bg, border: `1px solid ${step.color.main}40`,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: step.color.main === C.dim ? C.text : step.color.main, marginBottom: 4 }}>{step.label}</div>
              <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.3 }}>{step.sub}</div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 80 }}>
                <div style={{ fontSize: 9, color: C.dim, marginBottom: 4, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>{EDGE_LABELS[i]}</div>
                <svg width="80" height="12" viewBox="0 0 80 12">
                  <line x1="0" y1="6" x2="68" y2="6" stroke={STEPS[i + 1]?.color.main} strokeWidth="1.5" />
                  <polygon points="68,2 76,6 68,10" fill={STEPS[i + 1]?.color.main} />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  PAGE                                                             */
/* ═══════════════════════════════════════════════════════════════════ */

export default function ArchitecturePreviewPage() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", padding: "60px 24px", color: C.text }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* ── Simplified pipeline ── */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: C.blue, marginBottom: 12 }}>How It Works</div>
          <h1 style={{ fontSize: 36, fontWeight: 500, letterSpacing: "-0.03em", marginBottom: 12 }}>
            Four primitives. One governance layer.
          </h1>
          <p style={{ fontSize: 15, color: C.muted, maxWidth: 500, margin: "0 auto" }}>
            Every agent action flows through the same pipeline: identify, evaluate, approve, record.
          </p>
        </div>
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, padding: "0 24px" }}>
          <SimplifiedDiagram />
        </div>

        <div style={{ margin: "80px 0", borderTop: `1px solid ${C.border}` }} />

        {/* ── Product-in-context diagram ── */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: C.amber, marginBottom: 12 }}>System Architecture</div>
          <h2 style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.03em", marginBottom: 12 }}>
            Where SidClaw sits in your stack
          </h2>
          <p style={{ fontSize: 15, color: C.muted, maxWidth: 560, margin: "0 auto" }}>
            One SDK call from your agent code. Policy evaluation, human approval, and audit recording happen inside SidClaw. Reviewers get notified wherever they work.
          </p>
        </div>
        <div style={{
          borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg,
          padding: "40px 24px", overflowX: "auto",
          backgroundImage: "radial-gradient(circle, rgba(59,130,246,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}>
          <ContextDiagram />
        </div>
      </div>
    </div>
  );
}
