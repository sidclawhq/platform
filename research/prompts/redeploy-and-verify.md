# Task: Redeploy, Republish SDK, and Verify Production

## Overview

Critical bugfixes have been applied locally. Your job is to push the changes, trigger redeployment, republish the SDK to npm, and verify everything works in production.

## Step 1: Commit and Push

```bash
cd /Users/vlpetrov/Documents/Programming/agent-identity

# Check what changed
git status
git diff --stat

# Stage and commit
git add -A
git commit -m "fix: critical production bugfixes — dashboard API URL, SDK bundling, race condition, SoD normalization

- Fix NEXT_PUBLIC_API_URL baked into Docker build (was localhost:4000 in production)
- Bundle @sidclaw/shared into SDK (was missing from npm, blocking external installs)
- Fix separation of duties bypass via name normalization (case/whitespace)
- Fix double-approve race condition with atomic updateMany
- Add Create Agent button and modal to dashboard
- Add onboarding API key dialog after signup
- Fix flaky test timestamp ordering

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"

# Push
git push origin main
```

If push fails due to auth, check `gh auth status` and resolve.

## Step 2: Republish SDK to npm

```bash
cd /Users/vlpetrov/Documents/Programming/agent-identity/packages/sdk

# Bump version
npm version 0.1.1 -m "fix: bundle @sidclaw/shared, remove framework deps from main entry"

# Build
npm run build

# Verify the build is clean
npm pack --dry-run 2>&1 | head -30

# Verify @sidclaw/shared is NOT in dependencies
node -e "const pkg = require('./package.json'); console.log('dependencies:', JSON.stringify(pkg.dependencies ?? {})); console.log('version:', pkg.version);"
# dependencies should NOT contain @sidclaw/shared
# version should be 0.1.1

# Verify the bundle works standalone
cd /tmp && mkdir verify-sdk && cd verify-sdk
npm init -y
npm pack /Users/vlpetrov/Documents/Programming/agent-identity/packages/sdk
npm install sidclaw-sdk-0.1.1.tgz
node -e "const { AgentIdentityClient, withGovernance, ActionDeniedError } = require('@sidclaw/sdk'); console.log('Main:', typeof AgentIdentityClient, typeof withGovernance, typeof ActionDeniedError);"
node -e "const { verifyWebhookSignature } = require('@sidclaw/sdk/webhooks'); console.log('Webhooks:', typeof verifyWebhookSignature);"
echo "Local pack install works"
cd /Users/vlpetrov/Documents/Programming/agent-identity
rm -rf /tmp/verify-sdk

# Publish
cd /Users/vlpetrov/Documents/Programming/agent-identity/packages/sdk

# Check npm auth
npm whoami
# If not logged in, the user needs to run: ! npm login --scope=@sidclaw

npm publish --access public

# Push the version bump commit
cd /Users/vlpetrov/Documents/Programming/agent-identity
git push origin main
```

## Step 3: Verify npm Package

```bash
# Wait a moment for npm registry to update
sleep 10

# Test fresh install from npm (not local pack)
cd /tmp && mkdir verify-npm && cd verify-npm
npm init -y
npm install @sidclaw/sdk@0.1.1

# Test all imports
node -e "const { AgentIdentityClient } = require('@sidclaw/sdk'); console.log('Main CJS:', typeof AgentIdentityClient);"
node -e "const { verifyWebhookSignature } = require('@sidclaw/sdk/webhooks'); console.log('Webhooks CJS:', typeof verifyWebhookSignature);"

echo "npm install @sidclaw/sdk works!"

cd /Users/vlpetrov/Documents/Programming/agent-identity
rm -rf /tmp/verify-npm
```

Also verify on the web — open `https://www.npmjs.com/package/@sidclaw/sdk` using Playwright:
- Version should show 0.1.1
- README should render correctly
- Take a screenshot

## Step 4: Wait for Railway Deployment

Railway should auto-deploy from the push to main. If not:
- Check Railway dashboard for deployment status
- Trigger manual deploy if needed

The dashboard service is the critical one — it needs to rebuild with the new Dockerfile that bakes in `NEXT_PUBLIC_API_URL=https://api.sidclaw.com`.

Wait for all services to show "Active" / "Deployed" status.

## Step 5: Verify Production — API

```bash
# Health check
curl -s https://api.sidclaw.com/health | jq .
# Expected: { "status": "healthy", ... }

# Liveness probe
curl -s https://api.sidclaw.com/health/live | jq .
# Expected: { "status": "alive" }

# Auth rejection
curl -s https://api.sidclaw.com/api/v1/agents
# Expected: 401

# Auth with valid key (from seed or signup)
curl -s -H "Authorization: Bearer <key>" https://api.sidclaw.com/api/v1/agents | jq '.pagination'
# Expected: { total: N, limit: 20, offset: 0 }
```

## Step 6: Verify Production — Dashboard

Use Playwright MCP tools:

1. Navigate to `https://app.sidclaw.com`
2. Should redirect to login page (NOT show localhost errors)
3. Take a screenshot of the login page

4. Navigate to `https://app.sidclaw.com/signup`
5. Sign up with:
   - Name: `Production Verify`
   - Email: `verify-redeploy@sidclaw.com`
   - Password: `VerifyRedeploy2026!`
6. Should redirect to dashboard — does it load? Do API calls work?
7. Take a screenshot of the dashboard after signup

8. If onboarding API key dialog appears, take a screenshot (this verifies BUG 6 fix)

9. Navigate to Agents page
10. Verify "Register Agent" button is visible (BUG 5 fix)
11. Take a screenshot

12. Navigate to Settings > API Keys
13. Verify keys are listed
14. Take a screenshot

## Step 7: Verify Production — Rate Limiting

```bash
# Send rapid requests to verify rate limiting is active
for i in $(seq 1 65); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer <key>" \
    -X POST https://api.sidclaw.com/api/v1/agents \
    -H "Content-Type: application/json" \
    -d '{"name":"rate-test","description":"test","owner_name":"test","owner_role":"test","team":"test","authority_model":"self","identity_mode":"service_identity","delegation_model":"self","created_by":"test"}')
  if [ "$STATUS" = "429" ]; then
    echo "Rate limited at request $i — PASS"
    curl -s -I -H "Authorization: Bearer <key>" \
      -X POST https://api.sidclaw.com/api/v1/agents \
      -H "Content-Type: application/json" \
      -d '{"name":"rate-test","description":"test","owner_name":"test","owner_role":"test","team":"test","authority_model":"self","identity_mode":"service_identity","delegation_model":"self","created_by":"test"}' 2>/dev/null | grep -i "ratelimit\|retry-after"
    break
  fi
done
```

## Step 8: Verify Production — Full Governance Flow

```bash
API_KEY="<key from signup or seed>"

# 1. Create an agent
AGENT=$(curl -s -X POST https://api.sidclaw.com/api/v1/agents \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Verify Agent","description":"Production verification","owner_name":"Verifier","owner_role":"QA","team":"Test","authority_model":"self","identity_mode":"service_identity","delegation_model":"self","created_by":"verify-script"}')
AGENT_ID=$(echo $AGENT | jq -r '.data.id // .id')
echo "Agent: $AGENT_ID"

# 2. Create policies
curl -s -X POST https://api.sidclaw.com/api/v1/policies \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\":\"$AGENT_ID\",\"policy_name\":\"Allow reads\",\"operation\":\"read\",\"target_integration\":\"test\",\"resource_scope\":\"*\",\"data_classification\":\"internal\",\"policy_effect\":\"allow\",\"rationale\":\"Read operations are safe and within the agent standard operational scope.\",\"priority\":100,\"modified_by\":\"verify\"}"

curl -s -X POST https://api.sidclaw.com/api/v1/policies \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\":\"$AGENT_ID\",\"policy_name\":\"Approve writes\",\"operation\":\"write\",\"target_integration\":\"test\",\"resource_scope\":\"*\",\"data_classification\":\"confidential\",\"policy_effect\":\"approval_required\",\"rationale\":\"Write operations require human review for data integrity verification.\",\"priority\":100,\"modified_by\":\"verify\"}"

# 3. Evaluate — allow path
ALLOW=$(curl -s -X POST https://api.sidclaw.com/api/v1/evaluate \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\":\"$AGENT_ID\",\"operation\":\"read\",\"target_integration\":\"test\",\"resource_scope\":\"data\",\"data_classification\":\"internal\"}")
echo "Allow decision: $(echo $ALLOW | jq -r '.decision')"

# 4. Evaluate — approval path
APPROVAL=$(curl -s -X POST https://api.sidclaw.com/api/v1/evaluate \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\":\"$AGENT_ID\",\"operation\":\"write\",\"target_integration\":\"test\",\"resource_scope\":\"data\",\"data_classification\":\"confidential\",\"context\":{\"reason\":\"Production verification test\"}}")
echo "Approval decision: $(echo $APPROVAL | jq -r '.decision')"
APPROVAL_ID=$(echo $APPROVAL | jq -r '.approval_request_id')
TRACE_ID=$(echo $APPROVAL | jq -r '.trace_id')
echo "Approval ID: $APPROVAL_ID"

# 5. Check approval appears in dashboard (via API)
curl -s -H "Authorization: Bearer $API_KEY" "https://api.sidclaw.com/api/v1/approvals?status=pending" | jq '.pagination.total'

# 6. Approve it
curl -s -X POST "https://api.sidclaw.com/api/v1/approvals/$APPROVAL_ID/approve" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"approver_name":"Production Verifier","decision_note":"Verified in production"}'

# 7. Verify trace
curl -s -H "Authorization: Bearer $API_KEY" "https://api.sidclaw.com/api/v1/traces/$TRACE_ID" | jq '{events: [.events[].event_type]}'

# 8. Verify integrity
curl -s -H "Authorization: Bearer $API_KEY" "https://api.sidclaw.com/api/v1/traces/$TRACE_ID/verify" | jq .

echo "Full governance flow verified in production!"
```

## Step 9: Verify Remaining Services

Use Playwright:

1. Open `https://docs.sidclaw.com` — verify it loads
2. Open `https://sidclaw.com` — verify landing page loads
3. Take screenshots of both

## Step 10: Write Report

Save screenshots to `research/screenshots/redeploy-verify/`.

Write a report to `research/2026-03-22-redeploy-verification.md` with:

1. **Deployment status**: All services green on Railway?
2. **npm publish**: Version 0.1.1 live? External install works?
3. **Dashboard**: Login/signup works? No more localhost errors?
4. **Onboarding**: API key dialog visible after signup?
5. **Create Agent**: Button visible and functional?
6. **Rate limiting**: Active in production? At what request count?
7. **Full governance flow**: evaluate → approve → trace verified in production?
8. **All services**: API, Dashboard, Docs, Landing all accessible?
9. **Any remaining issues**: Anything still broken?
10. **Verdict**: Is the platform now launch-ready?
