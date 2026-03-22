# Stress Test 1: New User Journey

You are testing the live SidClaw platform at `https://sidclaw.com`. You are simulating a developer who just discovered the product and wants to try it out. Use Playwright MCP tools (mcp__playwright__*) for all browser interactions — navigate, click, fill forms, take screenshots.

**Do NOT modify any code or files in the repository. Only test and report.**

## Journey

### Step 1: Discover via Landing Page

1. Open `https://sidclaw.com` in the browser
2. Read the hero section — does the value proposition make sense in 5 seconds?
3. Scroll through all 9 sections
4. Check: do the stats cite sources? Is pricing clear? Does the comparison table make sense?
5. Click "Get Started Free" — where does it take you?
6. Take screenshots of: hero, pricing, comparison table

### Step 2: Sign Up

1. You should be at the signup page (`app.sidclaw.com/signup`)
2. Sign up with email:
   - Name: `Stress Test Developer`
   - Email: `stresstest1-dev@sidclaw.com` (or any test email)
   - Password: `StressTest2026!`
3. Does signup succeed? How long does it take?
4. Take a screenshot of the signup result

### Step 3: First Dashboard Experience

1. After signup, what do you see?
2. Is there an onboarding flow? API key dialog? Checklist?
3. Is the dashboard empty but navigable?
4. Click through every sidebar nav item: Overview, Agents, Policies, Approvals, Audit, Architecture, Settings
5. Does each page load? Any errors? Any broken pages?
6. Take screenshots of: overview (empty state), agents (empty), settings

### Step 4: Follow the Quickstart

1. Open `https://docs.sidclaw.com` in a new tab
2. Navigate to the Quick Start page
3. Can you follow the steps? Are they clear?
4. Note: you can't actually install the SDK in this test, but verify the code examples look correct and the instructions reference the right URLs (`api.sidclaw.com`, `app.sidclaw.com`)

### Step 5: Create Your First Agent (via Dashboard)

1. Go back to `app.sidclaw.com/dashboard/agents`
2. If there's a "Create Agent" button, try creating an agent:
   - Name: `Test Support Agent`
   - Description: `Customer support agent for stress testing`
   - Owner: `Stress Test Developer`
   - Role: `QA Team`
   - Team: `Testing`
   - Authority Model: `self`
   - Any other required fields
3. Does it work? What feedback do you get?
4. Take a screenshot of the agent detail page

### Step 6: Create a Policy

1. Navigate to Policies
2. If there's a "Create Policy" button, create a policy:
   - Agent: the one you just created
   - Name: `Require approval for customer emails`
   - Operation: `send_email`
   - Target Integration: `email_service`
   - Resource Scope: `customer_emails`
   - Classification: `confidential`
   - Effect: `approval_required`
   - Rationale: `Customer-facing emails require human review before sending to ensure compliance with communication standards.`
3. Does it save? Does it appear in the list?
4. Take a screenshot

### Step 7: Explore Settings

1. Navigate to Settings
2. Can you see: General, Users, API Keys, Webhooks, Audit Export?
3. Check API Keys — is there a default key listed?
4. Try creating a new API key — does the dialog show the raw key?
5. Take a screenshot of the API key creation dialog

### Step 8: Check Documentation

1. Open `https://docs.sidclaw.com`
2. Navigate to: Concepts > Approval
3. Navigate to: Compliance > FINRA 2026
4. Try the search (if it works)
5. Is the content helpful? Would a developer understand the product?
6. Take screenshots

## Deliverable

Write a report to `research/stress-tests/stress-test-1-new-user-journey.md` with:

1. **Journey timeline**: How long did each step take?
2. **Friction points**: Where did you get stuck or confused?
3. **Bugs found**: Anything broken, erroring, or misbehaving?
4. **UX assessment**:
   - Was the signup-to-first-agent flow smooth?
   - Did you understand what to do at each step?
   - What was missing?
5. **First impression**: As a developer, would you keep using this product after this first experience?
6. **Screenshots** saved to `research/screenshots/stress-tests/`
