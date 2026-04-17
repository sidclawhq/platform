# Docker Compose — full governed stack

Spins up a local SidClaw stack (PostgreSQL + API + dashboard) plus a sample
governed agent container. Everything runs in one network, no manual wiring.

## Start

```bash
docker compose up --build
```

- SidClaw API: http://localhost:4000
- SidClaw Dashboard: http://localhost:3000
- Sample agent container runs on start and emits one governed action

## Stop

```bash
docker compose down -v
```

Drops the volume so you start clean.
