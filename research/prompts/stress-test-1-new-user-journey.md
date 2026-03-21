# Stress Test 1: New User Journey (End-to-End)

You are a QA tester simulating a developer who has never seen SidClaw before. Use Playwright to interact with the dashboard as a real user would. Think like a developer trying this product for the first time — what would confuse you? What would break?

**Do NOT modify any code.** Only test and report.

## Prerequisites

1. Start all services:
   ```bash
   docker compose up db -d
   cd apps/api && npx prisma migrate deploy && npx prisma db seed && npm run dev &
   cd apps/dashboard && npm run dev &
   cd apps/docs && npm run dev &
   cd apps/landing && npm run dev &
   ```
2. Wait for all services to be ready.

## The Journey

### Step 1: Landing Page Discovery

Open `http://localhost:3002` (landing page).

- Read the hero section. Does the value proposition make sense in 5 seconds?
- Scroll through ALL sections. Look for:
  - Broken links (click every link)
  - Typos or awkward phrasing
  - Pricing inconsistencies (do the free tier limits match what the API actually enforces?)
  - Missing or broken images
  - Sections that don't render correctly
  - The npm install command — does the copy button work?
- Click "Get Started Free" — where does it go? Is the URL correct?
- Click "View on GitHub" — does the link work (or is it a placeholder)?
- Resize to mobile (375px) — does anything break or overlap?
- Take screenshots of anything that looks wrong.

### Step 2: Documentation Quick Start

Open `http://localhost:3001` (docs).

- Navigate to the Quick Start page.
- **Follow it literally, step by step**, as if you've never used the product:
  1. Does it tell you how to install? Is the command correct?
  2. Does it tell you how to get an API key? Is the link to signup clear?
  3. Is the code example copy-pasteable? Does it have the right imports?
  4. Are there any references to `@agent-identity` instead of `@sidclaw`?
  5. Does the "See it in action" step make sense?
- Check 3 random documentation pages for:
  - Broken internal links (click them)
  - Code examples that reference wrong package names
  - Pages that are empty or have placeholder content
  - Missing pages (click sidebar items that lead to 404)
- Try searching for: "webhook", "FINRA", "deny", "MCP"
- Take screenshots of any issues.

### Step 3: Signup

Open `http://localhost:3000/signup`.

- Try signing up with email/password:
  - Email: `newuser@test.com`, Password: `TestPass123`, Name: `New User`
  - Does the form validate? What happens with a short password (try "abc")?
  - What happens if you submit an empty form?
  - What error message do you get for each validation failure?
- After successful signup:
  - Where are you redirected?
  - Do you see your API key? Can you copy it?
  - Is there an onboarding checklist? Does it make sense?
  - What does the empty dashboard look like for a brand new user?
- Take a screenshot of the empty new-user dashboard.

### Step 4: First Agent Registration

As the new user, navigate to Agents page.

- Is it obvious how to create an agent? Is there a button?
- If there's a create button, fill in the form:
  - Name: "My First Agent"
  - Description: "Testing agent governance"
  - Owner: "New User"
  - Role: "Developer"
  - Team: "Engineering"
  - Environment: dev
  - Authority: self
  - Identity: service_identity
  - Delegation: self
  - Autonomy: low
- Does it succeed? What feedback do you get?
- If there's no create button in the UI, try via API:
  ```bash
  curl -X POST http://localhost:4000/api/v1/agents \
    -H "Cookie: session=<your_session_cookie>" \
    -H "X-CSRF-Token: <your_csrf_token>" \
    -H "Content-Type: application/json" \
    -d '{"name":"My First Agent","description":"Testing","owner_name":"New User","owner_role":"Dev","team":"Eng","environment":"dev","authority_model":"self","identity_mode":"service_identity","delegation_model":"self","created_by":"new-user"}'
  ```
- Does the new agent appear in the registry?
- Click on it — does the detail page show correct info?

### Step 5: First Policy

Navigate to Policies page.

- Create a policy for your new agent:
  - Effect: approval_required
  - Operation: "send_email"
  - Integration: "email_service"
  - Scope: "customer_emails"
  - Classification: confidential
  - Rationale: "Customer emails require human review for compliance"
- Does the form work? What happens if you forget the rationale?
- Does the policy appear in the list?
- Create a second policy:
  - Effect: allow
  - Operation: "read_docs"
  - Integration: "knowledge_base"
  - Scope: "*"
  - Classification: internal
  - Rationale: "Read access to internal docs is always permitted"

### Step 6: First SDK Evaluation

Using the API key from signup (or from Settings > API Keys), try evaluating an action:

```bash
# This should be ALLOWED
curl -X POST http://localhost:4000/api/v1/evaluate \
  -H "Authorization: Bearer <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"<your_agent_id>","operation":"read_docs","target_integration":"knowledge_base","resource_scope":"internal","data_classification":"internal"}'

# This should require APPROVAL
curl -X POST http://localhost:4000/api/v1/evaluate \
  -H "Authorization: Bearer <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"<your_agent_id>","operation":"send_email","target_integration":"email_service","resource_scope":"customer_emails","data_classification":"confidential"}'
```

- Do you get the correct decisions?
- Does the approval request appear in the dashboard?

### Step 7: First Approval

Go to the Approvals page in the dashboard.

- Is your approval request visible?
- Click on it — does the detail panel show the right context?
- Does "Why This Was Flagged" show your rationale?
- Type a note and click Approve.
- Does the toast appear?
- Does the queue refresh?

### Step 8: First Trace

Go to the Audit page.

- Can you find the traces from your evaluations?
- Click on a trace — does the timeline show the correct events?
- Is the event sequence logical? (trace_initiated → identity_resolved → policy_evaluated → ...)
- Do the timestamps make sense?

### Step 9: Edge Cases Along the Way

Try these at any point during the journey:

- **Back button**: Navigate forward and back — does the state persist correctly?
- **Refresh**: Refresh each page — does it reload correctly without errors?
- **Double-click**: Double-click the Approve button — does it approve twice?
- **Multiple tabs**: Open the dashboard in two tabs — does approving in one update the other?
- **Long strings**: Create an agent with a very long name (200 characters) — does the UI handle it?
- **Special characters**: Create an agent named `<script>alert('xss')</script>` — is it escaped?
- **Empty states**: What does each page look like when there's no data?

## Deliverable

Write a report to `research/stress-tests/01-new-user-journey.md` with:

1. **Journey log**: What happened at each step, in narrative form
2. **Friction points**: Where did you get confused or stuck?
3. **Bugs found**: With severity, location, and description
4. **Screenshots**: Save to `research/stress-tests/screenshots/01/` — especially anything broken or confusing
5. **UX recommendations**: What should be improved for the first-time experience?
6. **Edge case results**: What happened with each edge case test?
