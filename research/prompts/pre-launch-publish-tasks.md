# Task: Pre-Launch Publish Tasks

Three independent tasks. Do them in order — each is quick.

## Task 1: Publish SDK to npm

The SDK has been updated with the OpenClaw MCP proxy CLI binary. It needs to be republished.

```bash
cd /Users/vlpetrov/Documents/Programming/agent-identity/packages/sdk

# Check npm auth
npm whoami
# If not logged in, run: npm login --scope=@sidclaw

# Build
npm run build

# Bump version
npm version patch

# Verify pack contents (should include bin/)
npm pack --dry-run

# Publish
npm publish --access public
```

After publishing, verify:
```bash
# Test install in temp dir
cd /tmp && mkdir sidclaw-verify && cd sidclaw-verify
npm init -y
npm install @sidclaw/sdk@latest
node -e "const { AgentIdentityClient } = require('@sidclaw/sdk'); console.log('SDK:', typeof AgentIdentityClient);"
npx sidclaw-mcp-proxy 2>&1 | head -3
# Should show: "Error: SIDCLAW_API_KEY is required"
rm -rf /tmp/sidclaw-verify
```

Commit the version bump:
```bash
cd /Users/vlpetrov/Documents/Programming/agent-identity
git add packages/sdk/package.json
git commit -m "chore: bump SDK to $(node -p "require('./packages/sdk/package.json').version")"
git push origin main
```

## Task 2: Publish OpenClaw Skill to ClawHub

```bash
# Install clawhub CLI
npm install -g clawhub

# Login (opens browser for GitHub OAuth)
clawhub login

# Verify
clawhub whoami

# Publish the skill
clawhub publish /Users/vlpetrov/Documents/Programming/agent-identity/packages/openclaw-skill \
  --slug sidclaw-governance \
  --name "SidClaw Governance" \
  --version 1.0.0 \
  --changelog "Add policy evaluation, human approval, and audit trails to any MCP server tool. Powered by SidClaw." \
  --tags "security,governance,compliance,mcp,approval,finma,finra"

# Verify it's listed
clawhub search sidclaw
```

If `clawhub` CLI doesn't install globally, try:
```bash
npx clawhub login
npx clawhub publish ...
```

If ClawHub requires the skill to be in a specific format or the CLI isn't available, check https://docs.openclaw.ai/tools/clawhub for the current submission process.

## Task 3: Set Stripe Environment Variables in Railway

Use the Railway MCP tools or CLI to set the Stripe price IDs on the API service.

The price IDs from the billing session:

**Test mode:**
- Starter: `price_1TDrQsJGPXq4Jf4UPnY2LNvu`
- Business: `price_1TDrRRJGPXq4Jf4UnGAigUsx`

**Live mode:**
- Starter: `price_1TDrRdJGPXq4Jf4UEFfH8x0f`
- Business: `price_1TDrRmJGPXq4Jf4UBrikKlZY`

Set these on the Railway API service. Use whichever mode is appropriate (live for production):

```bash
# Via Railway CLI:
railway variables set STRIPE_STARTER_PRICE_ID=price_1TDrRdJGPXq4Jf4UEFfH8x0f
railway variables set STRIPE_BUSINESS_PRICE_ID=price_1TDrRmJGPXq4Jf4UBrikKlZY
```

Or use Railway MCP tools if available to set variables on the API service.

Also ensure these are already set (from the earlier billing setup):
- `STRIPE_SECRET_KEY` — should already be set
- `STRIPE_WEBHOOK_SECRET` — should already be set

If the webhook endpoint hasn't been registered in Stripe for production yet:

```bash
# Create production webhook via Stripe CLI or dashboard
stripe webhook_endpoints create \
  --url="https://api.sidclaw.com/api/v1/billing/webhook" \
  --enabled-events="checkout.session.completed,customer.subscription.updated,customer.subscription.deleted,invoice.payment_failed" \
  --api-key=sk_live_...
```

Note the webhook signing secret and set it:
```bash
railway variables set STRIPE_WEBHOOK_SECRET=whsec_...
```

After setting variables, redeploy the API service for changes to take effect.

## Verification

After all 3 tasks:

1. `npm info @sidclaw/sdk version` — should show the new version
2. `npx sidclaw-mcp-proxy` — should print "SIDCLAW_API_KEY is required"
3. `clawhub search sidclaw` — should find the governance skill
4. `curl https://api.sidclaw.com/api/v1/billing/status` — should not error about missing Stripe config
