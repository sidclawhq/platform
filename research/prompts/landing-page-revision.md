# Task: Comprehensive Landing Page Revision

## Context

You are working on the **SidClaw** platform landing page at `apps/landing/`. Read these files first:

1. `apps/landing/src/app/page.tsx` — current page structure (12 sections).
2. `apps/landing/src/components/` — all 12 current component files. Read every one to understand the existing content.
3. `README.md` — the GitHub README (for consistent messaging and content reference).
4. `research/2026-03-20-market-viability-assessment.md` — Executive Summary section for positioning context.
5. `LICENSE-PLATFORM` — FSL license (for accurate licensing messaging).

**Brand:** SidClaw. Domain: `sidclaw.com`. The product is an open-source SDK (Apache 2.0) + commercial hosted platform (FSL 1.1) for AI agent governance.

**Design system:** "Institutional Calm" — dark background (#0A0A0B), muted text (#E4E4E7/#A1A1AA/#71717A), surface layers (#111113, #1A1A1D), borders (#2A2A2E). Accent colors: amber (#F59E0B) for flagged/approval, green (#22C55E) for success/allow, red (#EF4444) for deny/block, blue (#3B82F6) for info/CTAs. Fonts: Inter for body, JetBrains Mono for code. No gradients, no AI sparkle, no decorative elements.

**Goal of this revision:** Make the landing page convert better. Every section must either build trust, demonstrate value, or drive the visitor to sign up or try a demo. The page must serve three audiences simultaneously: platform engineers (want code examples), CISOs (want risk reduction), and compliance officers (want regulatory mapping).

## Changes Required

### 1. Navigation — Add Docs link

**File:** `apps/landing/src/components/nav.tsx`

Add "Docs" link to the navigation, between the logo and the existing links:

```
SidClaw    Docs  |  Pricing  |  GitHub  |  [Get Started Free]
```

- Docs link: `https://docs.sidclaw.com` with `target="_blank"`
- Keep existing Pricing (#pricing anchor), GitHub, and Get Started Free links

### 2. Hero — Add code snippet preview

**File:** `apps/landing/src/components/hero.tsx`

Keep the existing headline, subheadline, and CTAs. Add a compact code preview below the npm install line that shows the core value proposition in code:

```typescript
// Before: your agent calls tools directly
await sendEmail(customer, subject, body);

// After: one wrapper, full governance
const governed = withGovernance(client, {
  operation: 'send_email',
  data_classification: 'confidential',
}, sendEmail);

await governed(customer, subject, body);
// → Policy evaluates → Approval if needed → Trace recorded
```

**Design:** Dark code block with syntax-highlighting colors. `bg-[#111113] border border-[#2A2A2E] rounded-lg p-6 font-mono text-sm`. Keep it compact — max 10 lines. The code should be immediately readable by a developer.

Add a label above the code block: `"5 lines to govern any tool"` in `text-xs uppercase tracking-wider text-[#71717A]`.

### 3. Problem Statement — No changes

Keep as-is. The stats and citation are correct.

### 4. Four Primitives — No changes

Keep as-is. The "Differentiator" badge on Approval is effective.

### 5. Approval Demo — Update to match Atlas Financial demo

**File:** `apps/landing/src/components/approval-demo.tsx`

The current mock shows a generic `database.execute_query` DELETE scenario. Update it to match the **Atlas Financial demo** — the first demo visitors will try:

**Updated mock approval card content:**

- **Header badges:** `HIGH` (amber risk badge), `PENDING` (muted)
- **Action:** `send_email → email_service`
- **Agent:** `Customer Communications Agent`
- **Resource scope:** `customer_emails` (in monospace)
- **Data classification:** `confidential` badge

- **Flagged section (amber left border):**
  - **Header:** "Why This Was Flagged"
  - **Policy name:** "Outbound customer email review"
  - **Message:** "Outbound customer communications require human review before sending to ensure compliance with FINRA communication standards and data handling policies."
  - **Policy version:** v1

- **Context snapshot section:**
  ```json
  {
    "recipient": "sarah.johnson@email.com",
    "subject": "Follow-up: Disputed transaction",
    "reason": "Customer requested callback after support ticket #5678"
  }
  ```

- **Action buttons:** Approve (green) / Deny (red)

This makes the mock consistent with what they'll see when they click "Try Demo →" on the Atlas Financial card below.

### 6. Comparison Table — No changes

Keep as-is. The "← the gap" annotation on Approval Workflow is effective.

### 7. Use Cases — Add OpenClaw as fourth use case

**File:** `apps/landing/src/components/use-cases.tsx`

Keep the existing three cards (Finance, Healthcare, Platform Teams). Add a **fourth card**:

**OpenClaw Ecosystem**
- Icon: 🦞 (or a claw/shield icon)
- Regulation tag: `329K+ agents`
- Title: "OpenClaw Skills"
- Description: "OpenClaw has 329K+ stars and 5,700+ skills — but 1,184 malicious skills were found in the ClawHavoc campaign. SidClaw adds the missing policy and approval layer to any OpenClaw skill."
- Link text: "Learn more →"
- Link: `https://docs.sidclaw.com/docs/integrations/openclaw` (target="_blank")

**Layout:** Change from 3-column to 4-column grid on desktop (or 2x2 grid). On mobile, stack vertically.

### 8. Demo Gallery — No changes

Keep as-is. The three demo cards with links are correct.

**One fix:** Verify the MedAssist demo link. The current component has `https://demo-health.sidclaw.com` — verify this matches the actual Railway deployment URL. If the actual URL is `https://demo-healthcare.sidclaw.com`, update it.

### 9. Pricing — Show Team price, fix email

**File:** `apps/landing/src/components/pricing.tsx`

**Changes:**

1. **Team tier: show a price.** Change from "Contact us" to a specific number. Use `$499/month` (or whatever you decide — this can be changed later). The point is: "Contact us" on the mid-tier kills conversion. Visitors who aren't ready for enterprise sales need a price they can approve within their team's budget.

   If you don't want to commit to a price yet, use: `Starting at $499/mo` with a note "Custom pricing for larger teams."

2. **Fix sales email.** Change `mailto:sales@sidclaw.com` to `mailto:hello@sidclaw.com` (which is the email that's actually configured with routing). Or keep `sales@` if routing has been set up for it.

3. **Highlight the Free tier CTA more prominently.** The Free tier is the funnel top — it should feel like the obvious first step. Add a note under the Free tier: "No credit card required."

4. **Add "Most Popular" badge to Team tier** (not Enterprise). Enterprise buyers don't make decisions from a pricing page — they want a sales call. Mid-market buyers (your first customers) compare Free vs Team.

**Updated pricing:**

| | Free | Team (Most Popular) | Enterprise |
|--|------|-----|-----------|
| Price | **$0**/month | **$499**/month | Custom |
| | No credit card required | | |
| Agents | 5 | 50 | Unlimited |
| Policies | 10 per agent | Unlimited | Unlimited |
| API keys | 2 | 10 | Unlimited |
| Trace retention | 7 days | 90 days | Custom |
| Support | Community | Email | Dedicated + SLA |
| SSO/OIDC | — | — | ✓ |
| CTA | Get Started | Start Team Trial | Contact Sales |
| Link | app.sidclaw.com/signup | hello@sidclaw.com | hello@sidclaw.com |

### 10. Open Source — Update licensing language

**File:** `apps/landing/src/components/open-source.tsx`

The current text says "The SDK is Apache 2.0 open source" but doesn't mention the platform license. Update to clearly explain the dual-license model:

**Updated content:**

**Heading:** "Open source at the core"

**Body:**
"The SDK is Apache 2.0 — use it anywhere, no restrictions. The platform is source-available under the Functional Source License (FSL) — inspect every line, self-host for internal use. After two years, all code converts to Apache 2.0."

**Subtext (smaller, muted):**
"We monetize the hosted platform, not the developer tool. Your governance SDK will always be free and open."

**Two buttons side by side:**
- "View SDK on GitHub" → `https://github.com/sidclawhq/platform` (target="_blank")
- "Read the FSL License" → `https://fsl.software` (target="_blank", or link to your LICENSE-PLATFORM on GitHub)

### 11. CTA Footer — No changes

Keep as-is. Clean and effective.

### 12. Footer — Expand with useful links

**File:** `apps/landing/src/components/footer.tsx`

The current footer is too minimal (just "SidClaw · GitHub · © 2026"). Expand it:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  SidClaw                                                         │
│  The approval layer for agentic AI                               │
│                                                                  │
│  Product           Developers         Compliance        Company  │
│  Dashboard         Docs               FINRA 2026        GitHub   │
│  Pricing           SDK on npm         EU AI Act         Contact  │
│  Live Demos        Quick Start        NIST AI RMF                │
│                    API Reference                                 │
│                    Examples                                       │
│                                                                  │
│  © 2026 SidClaw. SDK: Apache 2.0. Platform: FSL 1.1.           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Links:**

| Column | Link | URL | Target |
|--------|------|-----|--------|
| Product | Dashboard | https://app.sidclaw.com | _blank |
| Product | Pricing | #pricing | — |
| Product | Live Demos | #demos | — |
| Developers | Docs | https://docs.sidclaw.com | _blank |
| Developers | SDK on npm | https://www.npmjs.com/package/@sidclaw/sdk | _blank |
| Developers | Quick Start | https://docs.sidclaw.com/docs/quickstart | _blank |
| Developers | API Reference | https://docs.sidclaw.com/docs/api-reference | _blank |
| Developers | Examples | https://github.com/sidclawhq/platform/tree/main/examples | _blank |
| Compliance | FINRA 2026 | https://docs.sidclaw.com/docs/compliance/finra-2026 | _blank |
| Compliance | EU AI Act | https://docs.sidclaw.com/docs/compliance/eu-ai-act | _blank |
| Compliance | NIST AI RMF | https://docs.sidclaw.com/docs/compliance/nist-ai-rmf | _blank |
| Company | GitHub | https://github.com/sidclawhq/platform | _blank |
| Company | Contact | mailto:hello@sidclaw.com | — |

**Design:** 4-column grid on desktop, 2-column on tablet, stacked on mobile. Column headers in `text-xs uppercase tracking-wider text-[#71717A]`. Links in `text-sm text-[#A1A1AA] hover:text-[#E4E4E7]`. Bottom line in `text-xs text-[#71717A]` with license mention.

### 13. NEW SECTION: Social Proof / Standards (between Use Cases and Demo Gallery)

**Create new file:** `apps/landing/src/components/standards.tsx`

This section builds trust by showing the regulatory frameworks SidClaw maps to. Since you don't have customer logos yet, use regulation/standard logos instead:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│              Built for compliance frameworks                     │
│                                                                  │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐       │
│   │ FINRA   │   │ EU AI   │   │ NIST AI │   │ OWASP   │       │
│   │ 2026    │   │ Act     │   │ RMF     │   │ Agentic │       │
│   │         │   │         │   │         │   │ Top 10  │       │
│   └─────────┘   └─────────┘   └─────────┘   └─────────┘       │
│                                                                  │
│   SidClaw maps to FINRA 2026 agent governance requirements,     │
│   EU AI Act Articles 9/12/13/14, NIST AI RMF, and the OWASP    │
│   Top 10 for Agentic Applications.                               │
│                                                                  │
│              [View Compliance Documentation →]                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Design:** Four cards/badges in a row. Each shows the framework name in `text-sm font-medium` with a subtle border. Not logos (we don't have permission to use regulatory body logos) — just styled text labels.

Link: `https://docs.sidclaw.com/docs/compliance/finra-2026` (target="_blank")

### 14. Update Page Component Order

**File:** `apps/landing/src/app/page.tsx`

Add the new Standards section and update the import:

```tsx
import { Standards } from "@/components/standards";

// Updated order:
<Nav />
<main>
  <Hero />              {/* headline + code preview + CTAs */}
  <ProblemStatement />  {/* 73% / 79% / 37% stats */}
  <FourPrimitives />    {/* Identity → Policy → Approval → Trace */}
  <ApprovalDemo />      {/* Updated mock matching Atlas Financial */}
  <ComparisonTable />   {/* SidClaw vs Traditional IAM */}
  <UseCases />          {/* Finance + Healthcare + Platform + OpenClaw */}
  <Standards />         {/* NEW: FINRA / EU AI Act / NIST / OWASP */}
  <DemoGallery />       {/* Three interactive demos */}
  <Pricing />           {/* Free / Team / Enterprise */}
  <OpenSource />        {/* Updated dual-license explanation */}
  <CTAFooter />         {/* Final CTA */}
</main>
<Footer />              {/* Expanded with 4-column links */}
```

### 15. SEO Meta Tags

**File:** `apps/landing/src/app/layout.tsx` (or `page.tsx` metadata export)

Verify and update:

```typescript
export const metadata = {
  title: 'SidClaw — The Approval Layer for Agentic AI',
  description: 'Identity, policy, human approval, and audit for AI agents. Open-source SDK. FINRA 2026 and EU AI Act compliant. Try the interactive demo.',
  keywords: 'AI agent governance, AI agent security, AI agent approval, FINRA AI compliance, EU AI Act compliance, agent identity, MCP governance, LangChain security, OpenClaw governance',
  openGraph: {
    title: 'SidClaw — The Approval Layer for Agentic AI',
    description: 'Your agents need identity, policy, and human oversight. Not another IAM — the governance layer that\'s missing.',
    url: 'https://sidclaw.com',
    siteName: 'SidClaw',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SidClaw — The Approval Layer for Agentic AI',
    description: 'Identity, policy, approval, and audit for AI agents. Open-source SDK.',
  },
};
```

### 16. All External Links Open in New Tab

Every `<a>` tag linking to an external URL (anything not an anchor `#`) must have `target="_blank"` and `rel="noopener noreferrer"`. Audit all components and add where missing.

## Acceptance Criteria

- [ ] Nav has Docs link pointing to docs.sidclaw.com
- [ ] Hero has a code preview showing `withGovernance()` in action
- [ ] Approval demo mock matches Atlas Financial scenario (send_email, FINRA rationale, customer context)
- [ ] Use Cases has 4 cards: Finance, Healthcare, Platform Teams, OpenClaw
- [ ] OpenClaw card mentions 329K stars, ClawHavoc, and links to integration docs
- [ ] New Standards section shows FINRA / EU AI Act / NIST / OWASP with link to compliance docs
- [ ] Pricing: Team tier shows $499/month (or chosen price), Free tier says "No credit card required"
- [ ] Pricing: Team tier has "Most Popular" badge
- [ ] Pricing: sales emails use `hello@sidclaw.com` (or correct configured address)
- [ ] Open Source section explains dual licensing (Apache 2.0 SDK + FSL platform + 2-year conversion)
- [ ] Footer has 4 columns with links to Docs, SDK, Compliance pages, GitHub
- [ ] Footer shows license line: "SDK: Apache 2.0. Platform: FSL 1.1."
- [ ] All external links have `target="_blank"` and `rel="noopener noreferrer"`
- [ ] SEO meta tags updated with keywords including OpenClaw, FINRA, EU AI Act
- [ ] MedAssist demo link verified (demo-health vs demo-healthcare subdomain)
- [ ] Page loads in <2s, responsive on mobile
- [ ] "Institutional Calm" aesthetic maintained throughout all changes
- [ ] `turbo build` succeeds
- [ ] No hydration errors

## Constraints

- Do NOT change the overall page aesthetic — maintain "Institutional Calm"
- Do NOT add animations, gradients, or decorative elements
- Do NOT modify any backend code (API, SDK, dashboard)
- Do NOT change the landing page port (3002)
- Follow code style: files in `kebab-case.tsx`, components in `PascalCase`
