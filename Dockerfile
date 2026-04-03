# SidClaw MCP Governance Proxy
#
# Wraps any MCP server with policy evaluation, human approval, and audit trails.
# Supports stdio (default) and HTTP (Streamable HTTP) transport modes.
#
# --- stdio mode (default) ---
#   docker run --rm -i \
#     -e SIDCLAW_API_KEY=ai_your_key \
#     -e SIDCLAW_AGENT_ID=your_agent_id \
#     -e SIDCLAW_UPSTREAM_CMD=npx \
#     -e SIDCLAW_UPSTREAM_ARGS="-y,@modelcontextprotocol/server-postgres,postgresql://host/db" \
#     mcp/sidclaw-governance-mcp
#
# --- HTTP mode (Copilot Studio, GitHub Copilot, VS Code) ---
#   docker run -p 8080:8080 \
#     -e SIDCLAW_API_KEY=ai_your_key \
#     -e SIDCLAW_AGENT_ID=your_agent_id \
#     -e SIDCLAW_TRANSPORT=http \
#     mcp/sidclaw-governance-mcp
#
# --- Introspect mode (MCP registry inspection, Glama) ---
#   docker run --rm -i mcp/sidclaw-governance-mcp --introspect
#
# Environment variables:
#   SIDCLAW_API_KEY              (required, except --introspect) API key from app.sidclaw.com
#   SIDCLAW_AGENT_ID             (required, except --introspect) Agent ID registered in SidClaw
#   SIDCLAW_UPSTREAM_CMD         (required for stdio, except --introspect) Upstream MCP server command
#   SIDCLAW_UPSTREAM_ARGS        Comma-separated args for the upstream command
#   SIDCLAW_APPROVAL_MODE        "error" (default) or "block"
#   SIDCLAW_TOOL_MAPPINGS        JSON string of per-tool governance overrides
#   SIDCLAW_API_URL              API endpoint (default: https://api.sidclaw.com)
#   SIDCLAW_DEFAULT_CLASSIFICATION  Data classification (default: internal)
#   SIDCLAW_TRANSPORT            "stdio" (default) or "http"
#   SIDCLAW_PORT                 HTTP port when transport=http (default: 8080)
#   SIDCLAW_INTROSPECT           "true" to start in introspect mode

FROM node:22-slim

WORKDIR /app

# Install the SidClaw SDK (includes sidclaw-mcp-proxy binary) and MCP SDK peer dependency
RUN npm init -y && \
    npm install --production @sidclaw/sdk@0.1.10 @modelcontextprotocol/sdk && \
    npm cache clean --force

# Default transport: stdio
ENV SIDCLAW_TRANSPORT=stdio
ENV SIDCLAW_PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD if [ "$SIDCLAW_TRANSPORT" = "http" ]; then \
        node -e "require('http').get('http://localhost:${SIDCLAW_PORT}/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"; \
      else exit 0; fi

ENTRYPOINT ["node", "node_modules/@sidclaw/sdk/bin/sidclaw-mcp-proxy.cjs"]
