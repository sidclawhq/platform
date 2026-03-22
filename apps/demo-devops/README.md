# Nexus DevOps — Interactive Demo

AI infrastructure operations agent. Demonstrates governance for:
- **Allow:** Health checks, log reading
- **Approval Required:** Service scaling, production deployments
- **Deny:** Namespace deletion, secret rotation

## Run Locally

```bash
npm run dev  # Starts on port 3004
```

Open http://localhost:3004

## Environment Variables

```
SIDCLAW_API_URL=http://localhost:4000
DEMO_ADMIN_API_KEY=<key from deployment/.env.development>
```

## Production

Deployed at https://demo-devops.sidclaw.com
