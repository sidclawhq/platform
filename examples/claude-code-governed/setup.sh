#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# setup.sh — Create a SidClaw agent and policies for this example
# ─────────────────────────────────────────────────────────────

API_URL="${SIDCLAW_API_URL:-http://localhost:4000}"
API_KEY="${SIDCLAW_API_KEY:?Error: SIDCLAW_API_KEY is required. Find it in deployment/.env.development}"

AGENT_ID="claude-code-db-agent"

echo "SidClaw API: ${API_URL}"
echo ""

# Helper: POST to the API and handle errors
api_post() {
  local path="$1"
  local body="$2"
  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}${path}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "${body}")
  local http_code
  http_code=$(echo "$response" | tail -1)
  local body_text
  body_text=$(echo "$response" | sed '$d')

  if [ "$http_code" -ge 400 ]; then
    echo "  ERROR ${http_code}: ${body_text}" >&2
    return 1
  fi
  echo "$body_text"
}

# ── 1. Create agent ──────────────────────────────────────────

echo "Creating agent..."
agent_response=$(api_post "/api/v1/agents" '{
  "name": "Claude Code DB Agent",
  "description": "Claude Code querying PostgreSQL via governed MCP proxy",
  "owner_name": "Developer",
  "owner_role": "Engineering",
  "team": "Platform",
  "environment": "dev",
  "authority_model": "self",
  "identity_mode": "service_identity",
  "delegation_model": "self",
  "autonomy_tier": "medium",
  "authorized_integrations": [
    {
      "name": "PostgreSQL",
      "resource_scope": "sidclaw_demo",
      "data_classification": "internal",
      "allowed_operations": ["sql_query"]
    }
  ],
  "created_by": "claude-code-example"
}')

AGENT_ID=$(echo "$agent_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Agent created: ${AGENT_ID}"

# ── 2. Create policies ───────────────────────────────────────

echo ""
echo "Creating policies..."

# Policy 1: Allow SELECT queries (lowest priority — fallback)
api_post "/api/v1/policies" "{
  \"agent_id\": \"${AGENT_ID}\",
  \"policy_name\": \"Allow read queries\",
  \"operation\": \"sql_query\",
  \"target_integration\": \"postgresql\",
  \"resource_scope\": \"sidclaw_demo\",
  \"data_classification\": \"internal\",
  \"policy_effect\": \"allow\",
  \"rationale\": \"SELECT queries on the demo database are safe and within the agent operational scope.\",
  \"priority\": 50,
  \"modified_by\": \"claude-code-example\"
}" > /dev/null
echo "  [allow]             Allow read queries (priority 50)"

# Policy 2: Require approval for DELETE/UPDATE (medium priority)
api_post "/api/v1/policies" "{
  \"agent_id\": \"${AGENT_ID}\",
  \"policy_name\": \"Require approval for write operations\",
  \"operation\": \"sql_query\",
  \"target_integration\": \"postgresql\",
  \"resource_scope\": \"sidclaw_demo:write\",
  \"data_classification\": \"confidential\",
  \"policy_effect\": \"approval_required\",
  \"rationale\": \"DELETE and UPDATE statements modify data and require human review before execution.\",
  \"priority\": 100,
  \"max_session_ttl\": 3600,
  \"modified_by\": \"claude-code-example\"
}" > /dev/null
echo "  [approval_required] Require approval for writes (priority 100)"

# Policy 3: Deny DROP/TRUNCATE (highest priority)
api_post "/api/v1/policies" "{
  \"agent_id\": \"${AGENT_ID}\",
  \"policy_name\": \"Block destructive DDL\",
  \"operation\": \"sql_query\",
  \"target_integration\": \"postgresql\",
  \"resource_scope\": \"sidclaw_demo:destructive\",
  \"data_classification\": \"restricted\",
  \"policy_effect\": \"deny\",
  \"rationale\": \"DROP and TRUNCATE operations are prohibited. Agents must never destroy database objects.\",
  \"priority\": 200,
  \"modified_by\": \"claude-code-example\"
}" > /dev/null
echo "  [deny]              Block destructive DDL (priority 200)"

# ── Done ──────────────────────────────────────────────────────

echo ""
echo "Setup complete."
echo ""
echo "Agent ID: ${AGENT_ID}"
echo ""
echo "Next steps:"
echo "  1. Replace YOUR_API_KEY in .mcp.json with your actual API key"
echo "  2. Open Claude Code in this directory: claude"
echo "  3. Try: \"List all customers in the database.\""
echo "  4. Open http://localhost:3000/dashboard/approvals to see traces"
