# Brand Naming Research

**Date:** 2026-03-21
**Objective:** Find a name for the AI agent governance platform that works as company name, domain, npm scope, GitHub org, and CLI command.

## Constraints

- Short (1-2 words, max 10 characters ideal)
- No hyphens in primary name
- Easy to spell and pronounce
- Signals: security, governance, control, trust
- Institutional tone (not playful, not "AI assistant")
- Avoids overused AI naming patterns

## Candidate List

25 candidates researched across 5 categories. Availability checked via web search for domains, npm scopes, and GitHub orgs.

### Scoring Key

- **Memorability:** 1-5 (how sticky/distinctive the name is)
- **Pronunciation:** 1-5 (clarity when spoken aloud)
- **Enterprise credibility:** 1-5 (does it feel serious/institutional?)
- **Domain:** Best available TLD status
- **npm @scope:** Available / Taken
- **GitHub org:** Available / Taken (user = dormant personal account)

---

### Category 1: Classical Governance Vocabulary

| # | Name | Memorability | Pronunciation | Enterprise | Best Domain | npm | GitHub | Trademark Risk | Verdict |
|---|------|:-----------:|:------------:|:---------:|-------------|:---:|:------:|----------------|---------|
| 1 | **Aegis** | 4 | 3 | 5 | .dev (unclear) | Available | Taken (user) | EXTREME — Cloudflare Aegis, Aegis Authenticator, BigID AEGIS, plus a direct competitor (credential isolation proxy for AI agents) | AVOID |
| 2 | **Sentinel** | 5 | 5 | 5 | All taken | Available | Taken (user) | EXTREME — Microsoft Sentinel (SIEM), SentinelOne (NYSE), HashiCorp Sentinel (policy-as-code), plus "Sentinel" startup doing "Decision Firewall for AI Agents" | AVOID |
| 3 | **Arbiter** | 4 | 5 | 4 | .dev (unclear) | Available | Taken (user) | HIGH — $52M healthcare AI startup (2025), K-12 sports platform (Accel-KKR backed) owns .io | POOR |
| 4 | **Mandate** | 3 | 5 | 4 | .dev (likely free) | **Taken** | Taken (user) | LOW — no major tech conflicts, but npm scope is taken (`@mandate/core` exists) | BLOCKED (npm) |
| 5 | **Warden** | 4 | 5 | 4 | All taken | Available | Taken | HIGH — Warden Protocol (AI agents + blockchain, $200M valuation), Ruby Warden auth framework, multiple security companies | AVOID |
| 6 | **Charter** | 3 | 5 | 4 | .dev (possibly free) | Available | Taken (inactive) | HIGH — Charter Communications/Spectrum (Fortune 100) owns .com; .io for sale at $99,900 | EXPENSIVE |
| 7 | **Covenant** | 4 | 5 | 4 | All taken | Available | Taken (variants) | HIGH — Covenant C2 framework (offensive hacking tool) creates toxic association for a trust/governance product | AVOID |
| 8 | **Sanction** | 3 | 5 | 3 | .dev (parked) | Available | Taken | HIGH — word dominated by economic sanctions/AML compliance industry; dual meaning (authorize vs. punish) creates confusion | AVOID |

### Category 2: Latin/Greek Roots & Symbolic

| # | Name | Memorability | Pronunciation | Enterprise | Best Domain | npm | GitHub | Trademark Risk | Verdict |
|---|------|:-----------:|:------------:|:---------:|-------------|:---:|:------:|----------------|---------|
| 9 | **Vigil** | 5 | 5 | 5 | **.dev (for sale)** | **Available** | Taken (user) | MODERATE — VIGILTECH (new XDR platform), Vigil Framework (AI agent runtime), vigil-llm (prompt injection). No dominant player in IAM/governance | CONTENDER |
| 10 | **Sigil** | 4 | 4 | 4 | **.io (possibly free)** | Available | Taken (user) | MODERATE — Sigil EPUB editor (well-known in niche), Sigil Inc. (e-commerce, $1M seed). No one in IAM/governance | CONTENDER |
| 11 | **Custod** | 3 | 3 | 4 | **.dev (likely free)** | **Available** | Taken (dormant user) | **LOW** — Novel word. No company uses exact name. Custodia Technology (financial compliance) and Cloud Custodian (CNCF) use the root but different names | **TOP CONTENDER** |
| 12 | **Veritas** | 5 | 5 | 5 | All taken | Available | Taken (company) | SEVERE — Veritas Technologies ($1.5B+ revenue, 87% of Fortune 500). Non-starter | AVOID |
| 13 | **Praxis** | 4 | 5 | 4 | All taken | Unknown | Taken (active org) | EXTREME — Direct competitor (usepraxis.app) doing runtime governance for AI agents. Also prxs.ai (AI agent mesh), Google Praxis (ML lib) | AVOID |
| 14 | **Clave** | 3 | 4 | 3 | All taken | **Taken** | Taken (user) | HIGH — VC-backed crypto wallet (GetClave, $1.6M), Clave Security, common Spanish word | AVOID |
| 15 | **Gavel** | 4 | 5 | 4 | **.dev (possibly free)** | Available | Taken (user) | MODERATE — Gavel.io (legal tech company), NHS GAVEL (approval/validation engine). Strong metaphor but legal tech association | CONTENDER |

### Category 3: Action Words

| # | Name | Memorability | Pronunciation | Enterprise | Best Domain | npm | GitHub | Trademark Risk | Verdict |
|---|------|:-----------:|:------------:|:---------:|-------------|:---:|:------:|----------------|---------|
| 16 | **Attest** | 4 | 5 | 5 | All taken | Available | Taken (company) | HIGH — Attest Technologies ($85M raised, registered USPTO trademark), attest-framework (AI agent testing), GitHub Actions `actions/attest`, Apple App Attest | AVOID |
| 17 | **Ratify** | 4 | 5 | 4 | All taken (.dev = CNCF project) | Available | Taken | HIGH — CNCF Sandbox project "Ratify" at ratify.dev does Kubernetes artifact verification. Direct supply chain security overlap | AVOID |
| 18 | **Assent** | 3 | 4 | 4 | All taken | Unknown | Taken (org) | SEVERE — Assent Inc. ($1B valuation, $497M raised, supply chain compliance SaaS) + Microsoft Assent (enterprise approvals platform). Both in exact same problem space | AVOID |

### Category 4: Fortress/Defense

| # | Name | Memorability | Pronunciation | Enterprise | Best Domain | npm | GitHub | Trademark Risk | Verdict |
|---|------|:-----------:|:------------:|:---------:|-------------|:---:|:------:|----------------|---------|
| 19 | **Bastion** | 4 | 5 | 5 | All taken | **Taken** | Crowded | EXTREME — Azure Bastion (Microsoft PaaS), Bastion Technologies (cybersecurity compliance, ex-Palantir), "bastion host" is a standard networking term | AVOID |
| 20 | **Quorum** | 4 | 4 | 5 | All taken | Available | Taken | EXTREME — ConsenSys Quorum (JP Morgan trademark), Quorum Software (1,450 employees), Quorum US (public affairs, 500 employees) | AVOID |

### Category 5: Creative/Invented

| # | Name | Memorability | Pronunciation | Enterprise | Best Domain | npm | GitHub | Trademark Risk | Verdict |
|---|------|:-----------:|:------------:|:---------:|-------------|:---:|:------:|----------------|---------|
| 21 | **Auton** | 3 | 4 | 3 | .dev (likely free) | Available | Taken (user) | HIGH — CMU Auton Lab (prominent AI/ML research), Auton Motorized Systems (.com since 1978), too close to "autonomous" branding | POOR |
| 22 | **Pavlov** | 5 | 5 | 2 | .dev (likely free) | Available | Taken (user) | VERY HIGH — Pavlov VR (huge gaming brand), Pavlov Media (ISP, 44 states), DeepPavlov (NLP framework). Too many associations | AVOID |
| 23 | **Turnkey** | 3 | 5 | 3 | All taken | **Taken (active SDK)** | Taken | FATAL — Sequoia-backed crypto wallet startup owns .com, .io, .dev, and npm scope with active SDK packages | AVOID |
| 24 | **Ledgr** | 3 | 4 | 3 | **.dev + .io (likely free)** | Available | Taken (dormant user) | MODERATE — Ledgr Inc. (accounting, holds .com), but main risk is confusion with Ledger (crypto hardware wallet) + phishing domains | RISKY |
| 25 | **Aperim** | 2 | 3 | 3 | .io (possibly free) | **Taken** | **Taken (active org)** | MODERATE-HIGH — Aperim Pty Ltd (Sydney agency) controls .com, GitHub org, and npm scope | AVOID |

---

## Availability Summary: Contenders Only

Names that passed initial screening (no fatal conflicts, some path to domain + npm + GitHub):

| Name | .dev | .io | .com | npm @scope | GitHub | Key Risk |
|------|------|-----|------|-----------|--------|----------|
| **Custod** | Likely free | Taken (unknown) | Taken (unknown) | Available | Dormant user | Pronunciation ("kuh-STOD"? "KUSS-tod"?) |
| **Vigil** | For sale | Unclear | Taken | Available | Dormant user | VIGILTECH, Vigil Framework (small OSS projects) |
| **Sigil** | Taken (parked) | Possibly free | Taken (no server) | Available | Dormant user | Sigil EPUB editor (niche), pronunciation ("SIJ-il") |
| **Gavel** | Possibly free | Taken (legal tech) | Unknown | Available | Dormant user | Gavel.io legal tech company, NHS GAVEL |
| **Ledgr** | Likely free | Likely free | Taken | Available | Dormant user | Ledger brand confusion, phishing association |

---

## Top 3 Recommendations

### 1. Vigil (recommended)

**Score: 23/30**
| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Memorability | 5 | Real English word, immediately evocative |
| Pronunciation | 5 | Unambiguous: "VIJ-il" |
| Enterprise credibility | 5 | Institutional, serious, implies watchful oversight |
| Domain path | 4 | vigil.dev is for sale (Aftermarket.com) — purchasable |
| npm/GitHub path | 4 | @vigil available; GitHub user is dormant (contactable or use `vigilhq`) |

**Why Vigil:**
- The word means "a period of keeping awake during the time usually spent asleep, especially to keep watch or pray." This perfectly captures the product's role: staying awake and watching while AI agents act.
- It evokes vigilance, oversight, and watchfulness without being aggressive or militaristic.
- It matches the "Institutional Calm" design aesthetic — quiet authority, not loud enforcement.
- At 5 characters, it works everywhere: `vigil.dev`, `@vigil/sdk`, `npx vigil init`, `github.com/vigilhq`.
- The existing conflicts (VIGILTECH, Vigil Framework, vigil-llm) are all small OSS projects or very new startups, not established brands with trademark registrations.
- The .dev domain being explicitly listed for sale means there's a clear acquisition path.

**Risks:** VIGILTECH (new XDR security platform) and the Vigil Framework for AI agents could grow. The word shares a root with "vigilante" which has negative connotations, but "vigil" itself does not.

**Fallback domains:** `getvigil.dev`, `usevigil.dev`, `vigil.sh`

---

### 2. Custod (strong alternative)

**Score: 20/30**
| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Memorability | 3 | Novel word — less immediately recognizable |
| Pronunciation | 3 | Ambiguous: "KUS-tod" or "kuh-STOD"? Needs establishing |
| Enterprise credibility | 4 | Latin root conveys authority; sounds institutional |
| Domain path | 5 | custod.dev appears unregistered — likely available at standard price |
| npm/GitHub path | 5 | @custod available; GitHub user dormant |

**Why Custod:**
- **Best raw availability** of any candidate. Novel word means minimal trademark risk.
- From Latin *custos* (guardian/keeper) — etymologically perfect for a governance platform.
- Related to "custodian" which enterprises already associate with security (Cloud Custodian, data custodians, custody).
- Clean namespace: `custod.dev`, `@custod/sdk`, `npx custod init`, `github.com/custod`.
- No funded competitor or established product uses this exact name.

**Risks:** The name is invented, which means it needs more marketing effort to establish. Pronunciation ambiguity could hurt word-of-mouth. Some people might think it's a typo for "custard." The connection to Cloud Custodian (CNCF project for cloud governance rules) could cause conceptual confusion, even though the names are different.

**Fallback domains:** Not needed — primary likely available.

---

### 3. Sigil (creative option)

**Score: 21/30**
| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Memorability | 4 | Distinctive, slightly mysterious |
| Pronunciation | 4 | "SIJ-il" — clear once heard, but some may say "SIG-il" |
| Enterprise credibility | 4 | Evokes seals, marks of authority, authentication |
| Domain path | 4 | sigil.io may be available; sigil.dev is parked (purchasable) |
| npm/GitHub path | 5 | @sigil available; GitHub user dormant |

**Why Sigil:**
- A sigil is a seal or sign considered to have magical or mystical power — but in a security context, it evokes digital signatures, seals of approval, marks of authority.
- 5 characters, distinctive, memorable once learned.
- The existing companies using "Sigil" (EPUB editor, e-commerce startup) are in completely different spaces with no trademark overlap risk.
- Works well with the product's primitives: a sigil is literally a mark that grants or denies authority.
- `sigil.dev` or `sigil.io`, `@sigil/sdk`, `npx sigil init`, `github.com/sigilhq`.

**Risks:** The word has occult/mystical associations (magic sigils, warding symbols) which could feel inconsistent with the institutional tone. Some enterprises might find it too esoteric. The Sigil EPUB editor is well-known in its niche and dominates SEO for "sigil software."

**Fallback domains:** `getsigil.dev`, `sigil.sh`

---

---

## Round 2: Domain Pricing Reality Check (GoDaddy)

The initial round found good names but didn't verify pricing. GoDaddy/registrar checks revealed that most "available" domains for real English words are premium-priced:

### Existing Contenders — Actual Pricing

| Domain | Status | Price |
|--------|--------|-------|
| **custod.dev** | **Available (standard)** | **~$12-20/yr** |
| custod.io | Taken | — |
| custod.com | Premium (aftermarket) | $4,295 |
| vigil.dev | Premium | $5,000 |
| vigil.io | Taken (make offer) | Unknown |
| sigil.dev | Premium (aftermarket) | $3,999 |
| sigil.io | Taken (gambling site) | — |
| gavel.dev | Taken | — |
| gavel.io | Taken (legal tech) | — |
| ledgr.dev | Taken (parked) | — |
| ledgr.io | Taken | — |

**custod.dev is the only domain from the original 25 candidates available at standard registration price.**

### Round 2 Candidates — Invented/Uncommon Words

New candidates generated specifically to find affordable domains. DNS-verified (no A/NS/SOA records = likely unregistered).

| # | Name | Meaning | .dev | .io | .com | npm @scope | GitHub |
|---|------|---------|------|-----|------|-----------|--------|
| 1 | **adjur** | from "adjure" (to solemnly charge under oath) | **Likely free** | **Likely free** | Taken | Likely free | Likely free |
| 2 | **impri** | from "imprimatur" (official approval) | **Likely free** | **Likely free** | Taken | Likely free | Likely free |
| 3 | **assur** | from "assure" (to guarantee) | **Likely free** | Taken | **Likely free** | Likely free | Taken (user) |
| 4 | **edikt** | from "edict" (authoritative decree) | **Likely free** | Taken | Taken | Likely free | Likely free |
| 5 | **permis** | from "permission/permit" | **Likely free** | Taken | Taken | Likely free | Likely free |
| 6 | **curat** | from "curate/curator" (overseer) | **Likely free** | Taken | Taken | Likely free | Likely free |
| 7 | **deleg** | from "delegate" (to authorize) | **Likely free** | Taken | Taken | Likely free | Likely free |
| 8 | **revok** | from "revoke" (withdraw authority) | Taken | **Likely free** | Taken | Likely free | Likely free |

Standard pricing: .dev ~$12-20/yr, .io ~$45-65/yr, .com ~$10-15/yr.

---

## Revised Top 3 Recommendations (Cost-Conscious)

### 1. Custod (recommended)

**Revised score: BEST OVERALL**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Domain cost | 5 | **custod.dev available at ~$12-20/yr** — standard price, no premium |
| Memorability | 3 | Novel word, needs establishing |
| Pronunciation | 3 | "KUS-tod" — may need reinforcement |
| Enterprise credibility | 4 | Latin root (custos = guardian) conveys authority |
| npm/GitHub path | 5 | @custod available; GitHub user dormant |
| Trademark risk | 5 | Zero — novel word, no company uses it |

**Why Custod:**
- Only name from all 33 candidates where the primary domain is available at standard price
- From Latin *custos* (guardian/keeper) — etymologically perfect for governance
- Zero trademark risk (novel word)
- Clean namespace: `custod.dev`, `@custod/sdk`, `npx custod init`
- .com is acquirable at $4,295 if/when the business grows

**Risks:** Pronunciation ambiguity. Some might mishear as "custard." Needs marketing effort to establish. Consider pairing with a tagline that teaches the pronunciation: "Custod — the custodian of your AI agents."

**Fallback domains:** Not needed — primary available at standard price.

---

### 2. Adjur (strong alternative)

**Score: BEST NEW CANDIDATE**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Domain cost | 5 | adjur.dev + adjur.io both likely available at standard price |
| Memorability | 3 | Novel but pronounceable |
| Pronunciation | 4 | "AD-jur" — clear, one natural reading |
| Enterprise credibility | 4 | From "adjure" (to solemnly charge/command under oath) — strong legal connotation |
| npm/GitHub path | 5 | Both likely available |
| Trademark risk | 5 | Zero — novel word |

**Why Adjur:**
- Best multi-TLD availability: both .dev AND .io likely available at standard price
- "To adjure" means to earnestly urge or to bind under oath — perfect for an approval/authorization layer
- 5 characters, easy to type
- Clean namespace: `adjur.dev`, `@adjur/sdk`, `npx adjur init`

**Risks:** Less immediately recognizable than Custod's connection to "custodian." Some people won't know the word "adjure." Could be confused with "azure" in fast speech.

---

### 3. Impri (creative option)

**Score: MOST MEANINGFUL**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Domain cost | 5 | impri.dev + impri.io both likely available at standard price |
| Memorability | 3 | Short, snappy |
| Pronunciation | 4 | "IM-pree" — clear |
| Enterprise credibility | 3 | Less immediately institutional than Custod/Adjur |
| npm/GitHub path | 5 | Both likely available |
| Trademark risk | 5 | Zero — novel word |

**Why Impri:**
- From "imprimatur" — literally means "let it be printed," the official approval/license from an authority. This is the product's core action: granting or denying imprimatur for AI agent actions
- Both .dev and .io likely available at standard price
- 5 characters, clean namespace
- `impri.dev`, `@impri/sdk`, `npx impri init`

**Risks:** Could sound like "imprison" or "imprint" to some. Less enterprise gravitas than Custod. The connection to "imprimatur" is clever but may not be immediately obvious.

---

---

## Round 3: Compound Names (Two Words Combined)

Short invented words (custod, adjur, impri) felt too obscure. This round explores two-word compounds that are longer, more memorable, and have cheap domain availability.

30 compound candidates generated across three creative directions. Availability checked via InstantDomainSearch.com and DNS lookups.

### Tier 1 — .com + .dev + .io all available at standard price, zero conflicts

These are the gold finds. All three TLDs registrable at standard rates (~$10-15/yr .com, ~$12-16/yr .dev, ~$35-60/yr .io). No existing companies, no npm conflicts, no GitHub conflicts.

| # | Name | Chars | Meaning | .com | .dev | .io | npm | GitHub | Conflicts |
|---|------|:-----:|---------|:----:|:----:|:---:|:---:|:------:|-----------|
| 1 | **GrantSeal** | 9 | "Permission granted, sealed with authority" — approval action + institutional trust | Std | Std | Std | Free | Free | **None** |
| 2 | **DueSeal** | 7 | "Due diligence + seal of approval" — rigor of review + finality of approval | Std | Std | Std | Free | Free | **None** |
| 3 | **IronWrit** | 8 | "Iron" authority + "writ" (legal instrument compelling action) | Std | Std | Std | Free | Free | **None** |
| 4 | **GateTrace** | 9 | Maps directly to product primitives: approval gate + audit trace | Std | Std | Std | Free | Free | **None** (only a PCB layout term) |
| 5 | **DueWatch** | 8 | "Due diligence under watch" — ongoing vigilance | Std | Std | Std | Free | Free | **None** |
| 6 | **AdmitLine** | 9 | "The line where admission is granted" — checkpoint metaphor | Std | Std | Std | Free | Free | **None** |

### Tier 2 — .dev + .io available at standard price, .com premium/parked

| # | Name | Chars | Meaning | .com | .dev | .io | npm | GitHub | Conflicts |
|---|------|:-----:|---------|:----:|:----:|:---:|:---:|:------:|-----------|
| 7 | **StillGate** | 9 | "The quiet, still gate" — embodies Institutional Calm aesthetic perfectly | $4,999 | Std | Std | Free | Free | **None** |
| 8 | **DueGate** | 7 | "The gate of due process" — procedural rigor at the checkpoint | Parked | Std | Std | Free | Free | **None** |
| 9 | **WatchBrief** | 10 | Legal term: "watching brief" = monitoring with standing but not participating | $2,199 | Std | Std | Free | Free | **None** |
| 10 | **IronBrief** | 9 | "Iron" authority + intelligence dossier — unbreakable record | Lookup | Std | Std | Free | Free | **None** |
| 11 | **GrantLock** | 9 | "Grant" permission + "lock" enforcement — permissions locked until granted | Lookup | Std | Std | Free | Free | **None** |
| 12 | **TrueAudit** | 9 | Integrity + accountability — "the true audit" of agent actions | Parked | Std | Std | Free | Free | **None** |
| 13 | **GateClear** | 9 | Approval gate + clearance/transparency | Parked | Std | Std | Free | Free | Minor: "Clear Gate" is an Israeli cybersec firm (different word order) |
| 14 | **SealRing** | 8 | Historical signet ring metaphor — authority and certification | $2,499 | Std | Std | Free | Free | Minor: "seal ring" is a mechanical gasket term |

### Tier 3 — More limited availability or minor conflicts

| # | Name | Chars | Meaning | .com | .dev | .io | Conflicts |
|---|------|:-----:|---------|:----:|:----:|:---:|-----------|
| 15 | **GovTrace** | 8 | Governance + trace (portmanteau) | Lookup | Std | Std | Chilean AI platform "wAIse GovTrace" |
| 16 | **StillWatch** | 10 | Quiet vigilance — Institutional Calm aesthetic | $4,795 | Std | Lookup | PI firm + PR firm use the name |
| 17 | **AuditGate** | 9 | Audit checkpoint / approval gateway | $4,995 | Std | Std | .com is expensive |
| 18 | **IronPost** | 8 | Immovable duty station | $4,500 | Std | Std | Tiny Swift lib on GitHub |
| 19 | **PrimaGate** | 9 | Primary gateway for authorization | $3,795 | Std | Std | Agricultural fence brand |
| 20 | **TraceFair** | 9 | Accountability + fairness | SSL error | Std | Std | Swiss "FairTrace" supply chain co. |

---

## Final Revised Top 3 Recommendations

### 1. GrantSeal (top recommendation)

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Domain cost | **5** | .com + .dev + .io all available at standard price (~$10-60/yr total) |
| Memorability | **5** | Two clear English words, immediately meaningful |
| Pronunciation | **5** | Unambiguous: "GRANT-seal" |
| Enterprise credibility | **5** | "Grant" = formal authorization. "Seal" = institutional certification. Sounds like a department at a bank |
| npm/GitHub | **5** | @grantseal available, github.com/grantseal available |
| Trademark risk | **5** | Zero — no company uses this name |
| **Total** | **30/30** | |

**Why GrantSeal:** The rare perfect score. Every channel available at standard price, including .com. Two words that immediately communicate what the product does: it *grants* or withholds the *seal* of approval for AI agent actions. The name feels institutional — "The GrantSeal system approved the action" reads like enterprise software. Works everywhere: `grantseal.com`, `grantseal.dev`, `@grantseal/sdk`, `npx grantseal init`, `github.com/grantseal`.

---

### 2. DueSeal (shortest option)

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Domain cost | **5** | .com + .dev + .io all available at standard price |
| Memorability | **4** | Short and snappy, but "due" is less immediately vivid than "grant" |
| Pronunciation | **5** | Unambiguous: "DOO-seal" |
| Enterprise credibility | **5** | "Due" evokes due diligence, due process — governance language |
| npm/GitHub | **5** | @dueseal available, github.com/dueseal available |
| Trademark risk | **5** | Zero — no company uses this name |
| **Total** | **29/30** | |

**Why DueSeal:** At 7 characters, it's the most compact compound option. "Due" carries enormous weight in governance/compliance vocabulary (due diligence, due process, due care). Found independently by two separate research agents, confirming it's a natural, memorable combination. Same total availability as GrantSeal.

---

### 3. IronWrit (most distinctive)

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Domain cost | **5** | .com + .dev + .io all available at standard price |
| Memorability | **5** | Vivid imagery — sounds like a fantasy artifact or historical document |
| Pronunciation | **5** | Unambiguous: "EYE-urn-rit" |
| Enterprise credibility | **4** | "Writ" is perfect (legal instrument). "Iron" might feel slightly aggressive for Institutional Calm |
| npm/GitHub | **5** | @ironwrit available, github.com/ironwrit available |
| Trademark risk | **5** | Zero — no company uses this name |
| **Total** | **29/30** | |

**Why IronWrit:** The most memorable and distinctive name. A "writ" is a formal legal order — exactly the concept of a policy engine issuing allow/deny decisions. "Iron" conveys permanence and immutability — once the trace is written, it's ironclad. The name has gravitas. Works everywhere: `ironwrit.dev`, `@ironwrit/sdk`, `npx ironwrit init`.

---

## Honorable Mentions

- **GateTrace** (9 chars) — Maps directly to the product's primitives (gate + trace) but feels more descriptive than brandable. All TLDs available.
- **StillGate** (9 chars) — Best aesthetic fit for "Institutional Calm" but .com is $5K.
- **WatchBrief** (10 chars) — Most semantically precise (legal term for monitoring proceedings) but .com is $2.2K and it's 10 characters.
- **DueGate** (7 chars) — Very compact and strong but .com is parked.
- **Vigil** — Best single-word name semantically but vigil.dev is $5,000 premium.

## All Names Eliminated (Rounds 1-3)

<details>
<summary>Click to expand full elimination list (40+ names)</summary>

| Name | Primary Disqualifier |
|------|---------------------|
| Sentinel | Microsoft Sentinel + SentinelOne + HashiCorp Sentinel + direct AI agent competitor |
| Aegis | Cloudflare Aegis + direct AI agent competitor + 5+ security companies |
| Bastion | Azure Bastion + "bastion host" is a networking term + npm taken |
| Quorum | ConsenSys/JP Morgan trademark + Quorum Software (1,450 employees) |
| Veritas | Veritas Technologies ($1.5B+ revenue) |
| Praxis | Direct competitor (usepraxis.app) doing runtime governance for AI agents |
| Assent | $1B compliance company + Microsoft Assent approval platform |
| Turnkey | Sequoia-backed startup owns everything (.com, .io, .dev, npm scope) |
| Attest | USPTO registered trademark + GitHub Actions `actions/attest` |
| Ratify | CNCF Sandbox project at ratify.dev (supply chain verification) |
| Covenant | Covenant C2 hacking framework — toxic association for trust product |
| Warden | Warden Protocol ($200M valuation, AI agents + blockchain) |
| Pavlov | Pavlov VR + Pavlov Media + DeepPavlov — too crowded, not institutional |
| Clave | npm scope taken + VC-backed crypto startup |
| Aperim | Active company controls .com, GitHub org, and npm scope |
| Sanction | Economic sanctions industry dominates SEO |
| Arbiter | $52M healthcare AI startup + K-12 sports platform |
| Auton | CMU Auton Lab (AI/ML research) |
| Mandate | npm scope taken (`@mandate/core`) |
| Charter | Charter Communications (Fortune 100) + $100K for .io |
| Vigil | vigil.dev is $5,000 premium |
| Sigil | sigil.dev is $3,999 premium |
| Custod | Pronunciation ambiguity, too obscure |
| Adjur | Too obscure, confused with "azure" |
| Impri | Sounds like "imprison," too obscure |

</details>

---

## Next Steps

1. **Verify on registrar**: Check exact pricing on Porkbun or Cloudflare Registrar for `grantseal.com`, `grantseal.dev`, `grantseal.io` (and/or dueseal, ironwrit variants)
2. **Register all three TLDs**: At standard pricing this is ~$60-80/yr total for .com + .dev + .io
3. **Claim npm scope**: `npm org create grantseal` — first-come-first-served
4. **Create GitHub org**: `github.com/grantseal` — appears available
5. **USPTO search**: Run formal trademark search on [USPTO TESS](https://tmsearch.uspto.gov/) for the chosen name in Class 42 (SaaS/software)
6. **Secure social**: Check Twitter/X, LinkedIn company page availability

## Sources

All availability data gathered via web search, DNS lookups, and InstantDomainSearch.com (Playwright browser automation) on 2026-03-21. npm scope status verified via registry API. GitHub org status verified via web search. Company/product conflicts verified via web search, Crunchbase, and direct site visits. Domain pricing: "Std" = standard registration at ~$10-15/yr (.com), ~$12-16/yr (.dev), ~$35-60/yr (.io).
