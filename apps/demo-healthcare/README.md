# MedAssist Health — Interactive Demo

AI clinical assistant. Demonstrates governance for:
- **Allow:** Chart review, literature search
- **Approval Required:** Lab orders, patient communication
- **Deny:** Medication prescribing, treatment plan modification

## Run Locally

```bash
npm run dev  # Starts on port 3005
```

Open http://localhost:3005

## Environment Variables

```
SIDCLAW_API_URL=http://localhost:4000
DEMO_ADMIN_API_KEY=<key from deployment/.env.development>
```

## Production

Deployed at https://demo-healthcare.sidclaw.com
