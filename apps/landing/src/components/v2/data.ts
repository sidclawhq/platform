import type { LucideIcon } from "lucide-react";
import {
  Fingerprint,
  FileCheck,
  ShieldCheck,
  ScrollText,
  Landmark,
  Server,
  HeartPulse,
} from "lucide-react";

// ---- Primitives (four pillars) ----

export interface Primitive {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  color: string;
}

export const PRIMITIVES: Primitive[] = [
  {
    icon: Fingerprint,
    title: "Identity",
    description:
      "Register and manage every AI agent with an owner, scoped permissions, and lifecycle controls.",
    href: "https://docs.sidclaw.com/docs/concepts/agent-identity",
    color: "#3B82F6",
  },
  {
    icon: FileCheck,
    title: "Policy",
    description:
      "Define explicit rules for what agents can do. Priority-based matching, versioned, dry-run testable.",
    href: "https://docs.sidclaw.com/docs/concepts/policies",
    color: "#3B82F6",
  },
  {
    icon: ShieldCheck,
    title: "Approval",
    description:
      "High-risk actions surface a context-rich approval card. One click to approve or deny.",
    href: "https://docs.sidclaw.com/docs/concepts/approvals",
    color: "#F59E0B",
  },
  {
    icon: ScrollText,
    title: "Trace",
    description:
      "Every decision creates a hash-chained, tamper-evident audit trail. Exportable and verifiable.",
    href: "https://docs.sidclaw.com/docs/concepts/traces",
    color: "#22C55E",
  },
];

// ---- Compliance mapping table ----

export interface ComplianceRow {
  capability: string;
  sidclaw: string;
  finra: string;
  euai: string;
  finma: string;
  nist: string;
}

export const COMPLIANCE_TABLE: ComplianceRow[] = [
  {
    capability: "Agent Registration",
    sidclaw: "Agent Registry",
    finra: "Rule 3110(a)",
    euai: "Art. 9 \u2014 Risk Mgmt",
    finma: "Circ. 2023/1 \u00a73",
    nist: "MAP 1.1",
  },
  {
    capability: "Policy Enforcement",
    sidclaw: "Policy Engine",
    finra: "Rule 3110(b)",
    euai: "Art. 14 \u2014 Human Oversight",
    finma: "Circ. 2023/1 \u00a75",
    nist: "GOV 1.1",
  },
  {
    capability: "Human Oversight",
    sidclaw: "Approval Workflow",
    finra: "Rule 3110(c)",
    euai: "Art. 14.1 \u2014 Controls",
    finma: "Circ. 2023/1 \u00a77",
    nist: "GOV 5.1",
  },
  {
    capability: "Audit Trail",
    sidclaw: "Hash-Chain Traces",
    finra: "Rule 3110(d)",
    euai: "Art. 12 \u2014 Logging",
    finma: "Circ. 2023/1 \u00a79",
    nist: "MEA 2.1",
  },
  {
    capability: "Risk Classification",
    sidclaw: "Risk Engine",
    finra: "Rule 3110(e)",
    euai: "Art. 9.2 \u2014 Assessment",
    finma: "Circ. 2024/1 \u00a72",
    nist: "MAP 2.1",
  },
];

// ---- Pricing plans ----

export interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  ctaNote: string | null;
  highlight: boolean;
  badge?: string;
}

export const PLANS: Plan[] = [
  {
    name: "Free",
    price: "CHF 0",
    period: "/month",
    description: "For experimentation and small projects",
    features: [
      "5 agents",
      "10 policies per agent",
      "2 API keys",
      "7-day trace retention",
      "1 webhook",
      "Community support",
    ],
    cta: "Start Free",
    ctaHref: "https://app.sidclaw.com/signup",
    ctaNote: null,
    highlight: false,
  },
  {
    name: "Starter",
    price: "CHF 199",
    period: "/month",
    description: "For teams shipping their first governed agents",
    features: [
      "15 agents",
      "50 policies per agent",
      "5 API keys",
      "30-day retention",
      "3 webhooks",
      "Email support",
    ],
    cta: "Start Free",
    ctaHref: "https://app.sidclaw.com/signup?plan=starter",
    ctaNote: null,
    highlight: false,
  },
  {
    name: "Business",
    price: "CHF 999",
    period: "/month",
    description: "For production teams with compliance needs",
    features: [
      "100 agents",
      "Unlimited policies",
      "20 API keys",
      "90-day retention",
      "10 webhooks",
      "SSO/OIDC",
      "Priority email support",
    ],
    cta: "Start Free",
    ctaHref: "https://app.sidclaw.com/signup?plan=business",
    ctaNote: null,
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    price: "From CHF 3,000",
    period: "/month",
    description: "Self-hosted or managed, with dedicated support",
    features: [
      "Unlimited agents",
      "Unlimited everything",
      "Self-hosted in your VPC",
      "Dedicated support & SLA",
      "Compliance documentation",
      "FINMA/EU AI Act mapping",
      "Custom integrations",
    ],
    cta: "Start Free",
    ctaHref: "https://app.sidclaw.com/signup?plan=enterprise",
    ctaNote: null,
    highlight: false,
  },
];

// ---- Demo cards ----

export interface Demo {
  industry: string;
  title: string;
  description: string;
  badge: string;
  features: string[];
  url: string;
  accentColor: string;
  icon: LucideIcon;
}

export const DEMOS: Demo[] = [
  {
    industry: "Financial Services",
    title: "Atlas Financial",
    description:
      "AI customer support agent sends emails, looks up accounts, and handles sensitive data. See FINRA-compliant approval workflows in action.",
    badge: "FINRA 2026",
    features: ["Chat with AI agent", "Email approval flow", "PII export blocked"],
    url: "https://demo.sidclaw.com",
    accentColor: "#F59E0B",
    icon: Landmark,
  },
  {
    industry: "DevOps & Platform",
    title: "Nexus Labs",
    description:
      "AI ops agent monitors infrastructure, scales services, and deploys to production. See how governance prevents destructive actions.",
    badge: "Deploy Safety",
    features: [
      "Live service monitoring",
      "Production deploy approval",
      "Namespace deletion blocked",
    ],
    url: "https://demo-devops.sidclaw.com",
    accentColor: "#3B82F6",
    icon: Server,
  },
  {
    industry: "Healthcare",
    title: "MedAssist Health",
    description:
      "AI clinical assistant reviews patient charts and recommends treatments. See HIPAA-compliant controls that keep physicians in the loop.",
    badge: "HIPAA",
    features: [
      "Patient chart review",
      "Lab order approval",
      "Prescriptions blocked for AI",
    ],
    url: "https://demo-health.sidclaw.com",
    accentColor: "#22C55E",
    icon: HeartPulse,
  },
];

// ---- Syntax-highlighted code tokens ----

export interface CodeToken {
  text: string;
  color: string;
}

export const TS_CODE: CodeToken[] = [
  { text: "import", color: "#C084FC" },
  { text: " { AgentIdentityClient } ", color: "#F0F0F3" },
  { text: "from", color: "#C084FC" },
  { text: " '@sidclaw/sdk'", color: "#34D399" },
  { text: ";\n\n", color: "#6B6E7B" },
  { text: "const", color: "#C084FC" },
  { text: " client ", color: "#F0F0F3" },
  { text: "=", color: "#6B6E7B" },
  { text: " new", color: "#C084FC" },
  { text: " AgentIdentityClient", color: "#F472B6" },
  { text: "({\n", color: "#F0F0F3" },
  { text: "  apiKey", color: "#93C5FD" },
  { text: ": ", color: "#6B6E7B" },
  { text: "process.env.", color: "#F0F0F3" },
  { text: "SIDCLAW_API_KEY", color: "#34D399" },
  { text: ",\n", color: "#6B6E7B" },
  { text: "  apiUrl", color: "#93C5FD" },
  { text: ": ", color: "#6B6E7B" },
  { text: "'https://api.sidclaw.com'", color: "#34D399" },
  { text: ",\n", color: "#6B6E7B" },
  { text: "  agentId", color: "#93C5FD" },
  { text: ": ", color: "#6B6E7B" },
  { text: "'customer_support'", color: "#34D399" },
  { text: ",\n});\n\n", color: "#6B6E7B" },
  { text: "const", color: "#C084FC" },
  { text: " result ", color: "#F0F0F3" },
  { text: "=", color: "#6B6E7B" },
  { text: " await", color: "#C084FC" },
  { text: " client.", color: "#F0F0F3" },
  { text: "evaluate", color: "#93C5FD" },
  { text: "({\n", color: "#F0F0F3" },
  { text: "  operation", color: "#93C5FD" },
  { text: ": ", color: "#6B6E7B" },
  { text: "'send_email'", color: "#34D399" },
  { text: ",\n", color: "#6B6E7B" },
  { text: "  target_integration", color: "#93C5FD" },
  { text: ": ", color: "#6B6E7B" },
  { text: "'email_service'", color: "#34D399" },
  { text: ",\n", color: "#6B6E7B" },
  { text: "  resource_scope", color: "#93C5FD" },
  { text: ": ", color: "#6B6E7B" },
  { text: "'customer_data'", color: "#34D399" },
  { text: ",\n", color: "#6B6E7B" },
  { text: "  data_classification", color: "#93C5FD" },
  { text: ": ", color: "#6B6E7B" },
  { text: "'confidential'", color: "#34D399" },
  { text: ",\n});\n\n", color: "#6B6E7B" },
  { text: "if", color: "#C084FC" },
  { text: " (result.", color: "#F0F0F3" },
  { text: "decision", color: "#93C5FD" },
  { text: " === ", color: "#6B6E7B" },
  { text: "'allow'", color: "#34D399" },
  { text: ") {\n", color: "#F0F0F3" },
  { text: "  await", color: "#C084FC" },
  { text: " sendEmail", color: "#93C5FD" },
  { text: "(recipient, body);\n}", color: "#F0F0F3" },
];

export const PY_CODE: CodeToken[] = [
  { text: "from", color: "#C084FC" },
  { text: " sidclaw ", color: "#F0F0F3" },
  { text: "import", color: "#C084FC" },
  { text: " SidClaw", color: "#F472B6" },
  { text: "\n\n", color: "" },
  { text: "client ", color: "#F0F0F3" },
  { text: "=", color: "#6B6E7B" },
  { text: " SidClaw", color: "#F472B6" },
  { text: "(\n", color: "#F0F0F3" },
  { text: "    api_key", color: "#93C5FD" },
  { text: "=", color: "#6B6E7B" },
  { text: "os.environ", color: "#F0F0F3" },
  { text: "[", color: "#6B6E7B" },
  { text: '"SIDCLAW_API_KEY"', color: "#34D399" },
  { text: "]", color: "#6B6E7B" },
  { text: ",\n", color: "#6B6E7B" },
  { text: "    api_url", color: "#93C5FD" },
  { text: "=", color: "#6B6E7B" },
  { text: '"https://api.sidclaw.com"', color: "#34D399" },
  { text: ",\n", color: "#6B6E7B" },
  { text: "    agent_id", color: "#93C5FD" },
  { text: "=", color: "#6B6E7B" },
  { text: '"customer_support"', color: "#34D399" },
  { text: ",\n)\n\n", color: "#6B6E7B" },
  { text: "result ", color: "#F0F0F3" },
  { text: "=", color: "#6B6E7B" },
  { text: " client.", color: "#F0F0F3" },
  { text: "evaluate", color: "#93C5FD" },
  { text: "({\n", color: "#F0F0F3" },
  { text: '    "operation"', color: "#34D399" },
  { text: ": ", color: "#6B6E7B" },
  { text: '"send_email"', color: "#34D399" },
  { text: ",\n", color: "#6B6E7B" },
  { text: '    "target_integration"', color: "#34D399" },
  { text: ": ", color: "#6B6E7B" },
  { text: '"email_service"', color: "#34D399" },
  { text: ",\n", color: "#6B6E7B" },
  { text: '    "resource_scope"', color: "#34D399" },
  { text: ": ", color: "#6B6E7B" },
  { text: '"customer_data"', color: "#34D399" },
  { text: ",\n", color: "#6B6E7B" },
  { text: '    "data_classification"', color: "#34D399" },
  { text: ": ", color: "#6B6E7B" },
  { text: '"confidential"', color: "#34D399" },
  { text: ",\n})\n\n", color: "#6B6E7B" },
  { text: "if", color: "#C084FC" },
  { text: " result.", color: "#F0F0F3" },
  { text: "decision", color: "#93C5FD" },
  { text: " == ", color: "#6B6E7B" },
  { text: '"allow"', color: "#34D399" },
  { text: ":\n", color: "#F0F0F3" },
  { text: "    send_email", color: "#93C5FD" },
  { text: "(recipient, body)", color: "#F0F0F3" },
];

// ---- Compliance badges ----

export const COMPLIANCE_BADGES = [
  "FINRA 2026",
  "EU AI Act",
  "HIPAA",
  "FINMA",
  "NIST AI RMF",
  "OWASP Agentic",
  "SOC 2 Ready",
];

// ---- Developer features checklist ----

export const DEVELOPER_FEATURES = [
  "TypeScript + Python SDKs",
  "16 framework integrations",
  "MCP governance proxy",
  "Webhook callbacks",
  "GitHub Action for CI governance",
  "Apache 2.0 license",
];

// ---- Approval workflow features ----

export const APPROVAL_FEATURES = [
  { label: "Risk classification", detail: "Automatic low/medium/high/critical scoring" },
  { label: "Context snapshots", detail: "Full action payload frozen at decision time" },
  { label: "Separation of duties", detail: "Requester cannot approve their own request" },
  { label: "Hash-chain integrity", detail: "Every event is tamper-evident and verifiable" },
];

// ---- Footer columns ----

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Dashboard", href: "https://app.sidclaw.com" },
      { label: "Pricing", href: "#pricing" },
      { label: "Live Demos", href: "#demos" },
      { label: "Changelog", href: "https://github.com/sidclawhq/platform/releases" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "https://docs.sidclaw.com" },
      { label: "SDK on npm", href: "https://www.npmjs.com/package/@sidclaw/sdk" },
      { label: "Python SDK", href: "https://pypi.org/project/sidclaw/" },
      { label: "Quick Start", href: "https://docs.sidclaw.com/docs/quickstart" },
      { label: "API Reference", href: "https://docs.sidclaw.com/docs/api-reference" },
    ],
  },
  {
    title: "Compliance",
    links: [
      { label: "FINRA 2026", href: "https://docs.sidclaw.com/docs/compliance/finra-2026" },
      { label: "EU AI Act", href: "https://docs.sidclaw.com/docs/compliance/eu-ai-act" },
      { label: "FINMA", href: "https://docs.sidclaw.com/docs/compliance/finma" },
      { label: "NIST AI RMF", href: "https://docs.sidclaw.com/docs/compliance/nist-ai-rmf" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "GitHub", href: "https://github.com/sidclawhq/platform" },
      { label: "Contact", href: "mailto:hello@sidclaw.com" },
      { label: "FSL License", href: "https://fsl.software" },
    ],
  },
];
