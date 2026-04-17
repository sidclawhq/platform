# sidclaw-demo

Zero-install SidClaw demo. Starts a local governance dashboard with four
pre-loaded scenarios — you can approve, deny, and inspect the hash-chained
trace for each one.

## Try it

```bash
npx sidclaw-demo
```

Opens `http://localhost:3030` in your browser. Press `Ctrl+C` to stop.

Options:

```bash
npx sidclaw-demo --port 8080
npx sidclaw-demo --no-open
npx sidclaw-demo --help
```

## What you see

Four governance scenarios from real industries:

| Agent | Action | Policy | Status |
|-------|--------|--------|--------|
| Claude Code | `rm -rf ./data/` | Destructive bash requires approval | Pending (interactive) |
| Portfolio Rebalancer | Sell 500 AAPL (~$107K) | FINRA 2026 trade threshold | Pending (interactive) |
| Nexus Infra Bot | `kubectl scale replicas=0` in prod | Scale-to-zero requires approval | Already approved |
| MedAssist Clinical | Order CBC lab test | HIPAA physician approval | Already denied |

For the two pending scenarios, you can click Approve or Deny — the trace
viewer updates in real time with the final decision event.

## What this is not

- Not connected to a real SidClaw instance
- Not persisted — scenario state resets on restart
- Not a substitute for the full platform — this shows the approval card UX

## Ready to deploy?

```bash
npx create-sidclaw-app
```

This scaffolds a real governed agent with 3 policies and connects it to
your SidClaw instance (SaaS or self-hosted).

---

MIT licensed.
