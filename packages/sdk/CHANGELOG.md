# Changelog

## 0.1.1

- Add MCP governance proxy CLI (`sidclaw-mcp-proxy`)
- Add OpenClaw skill and integration
- Add framework wrappers: OpenAI Agents SDK, CrewAI
- Fix 429 retry test timeout
- Improve error message when `@modelcontextprotocol/sdk` is not installed

## 0.1.0

Initial release.

- `AgentIdentityClient` — evaluate actions, wait for approval, record outcomes
- `withGovernance()` — higher-order function wrapper
- `GovernanceMCPServer` — MCP governance proxy
- Framework wrappers: LangChain, Vercel AI
- `verifyWebhookSignature()` — webhook payload verification
