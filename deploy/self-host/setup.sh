#!/bin/bash
# SidClaw Self-Host Quick Setup
# Run: curl -sSL https://raw.githubusercontent.com/sidclawhq/platform/main/deploy/self-host/setup.sh | bash

set -e

echo ""
echo "SidClaw Self-Host Setup"
echo "======================="
echo ""

# ── Check prerequisites ──────────────────────────────────────────────────────

check_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Error: $1 is required. $2"; exit 1; }
}

check_cmd docker "Install: https://docs.docker.com/get-docker/"
check_cmd git "Install: https://git-scm.com/downloads"
check_cmd curl "Install curl via your package manager."
check_cmd openssl "Install openssl via your package manager."

# Check Docker Compose (v2 plugin or standalone)
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Error: Docker Compose is required. Install: https://docs.docker.com/compose/install/"
  exit 1
fi

# ── Check port availability ──────────────────────────────────────────────────

check_port() {
  if lsof -i :"$1" >/dev/null 2>&1 || ss -ltn 2>/dev/null | grep -q ":$1 " 2>/dev/null; then
    echo "Warning: Port $1 is already in use ($2)."
    echo "  Set ${3}=$1 in .env to use a different port, or stop the conflicting service."
    echo ""
    PORT_CONFLICT=1
  fi
}

PORT_CONFLICT=0
check_port 4000 "API" "API_PORT"
check_port 3000 "Dashboard" "DASHBOARD_PORT"
check_port 3001 "Docs" "DOCS_PORT"
check_port 3002 "Landing" "LANDING_PORT"

if [ "$PORT_CONFLICT" -eq 1 ]; then
  echo "Continuing anyway — Docker may override host port bindings."
  echo ""
fi

# ── Clone ────────────────────────────────────────────────────────────────────

if [ -d "sidclaw" ]; then
  echo "Directory 'sidclaw' already exists. Using existing clone."
  cd sidclaw
  git pull origin main || true
else
  echo "Cloning SidClaw..."
  git clone https://github.com/sidclawhq/platform.git sidclaw
  cd sidclaw
fi

# ── Generate secrets ─────────────────────────────────────────────────────────

SESSION_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 16)

# ── Create .env ──────────────────────────────────────────────────────────────

if [ -f ".env" ]; then
  echo "Existing .env found — backing up to .env.backup"
  cp .env .env.backup
fi

cat > .env << EOF
DB_NAME=sidclaw
DB_USER=sidclaw
DB_PASSWORD=${DB_PASSWORD}
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
ALLOWED_ORIGINS=http://localhost:3000
DASHBOARD_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
RATE_LIMIT_ENABLED=true
COOKIE_DOMAIN=localhost
SECURE_COOKIES=false
EOF

echo "Environment configured (.env created)"

# ── Build and start ──────────────────────────────────────────────────────────

echo ""
echo "Building and starting SidClaw (this may take 5-10 minutes on first run)..."
$COMPOSE -f docker-compose.production.yml up -d --build

# ── Wait for API ─────────────────────────────────────────────────────────────

echo ""
echo "Waiting for API to be ready..."
API_READY=0
for i in $(seq 1 60); do
  if curl -sf http://localhost:4000/health > /dev/null 2>&1; then
    echo "API is ready"
    API_READY=1
    break
  fi
  sleep 2
done

if [ "$API_READY" -eq 0 ]; then
  echo ""
  echo "Error: API did not become healthy within 120 seconds."
  echo "Check logs: $COMPOSE -f docker-compose.production.yml logs api"
  exit 1
fi

# ── Seed database ────────────────────────────────────────────────────────────

echo "Seeding database..."
$COMPOSE -f docker-compose.production.yml exec -T api tsx prisma/seed.ts

echo ""
echo "============================================"
echo "  SidClaw is running!"
echo "============================================"
echo ""
echo "  Dashboard:  http://localhost:3000"
echo "  API:        http://localhost:4000"
echo "  Docs:       http://localhost:3001"
echo "  Landing:    http://localhost:3002"
echo ""
echo "  Login: admin@example.com / admin"
echo "  Or click 'Sign in with SSO' for dev-login (no password needed)"
echo ""
echo "  To get your API key, run:"
echo "    $COMPOSE -f docker-compose.production.yml exec api cat /app/deployment/.env.development"
echo ""
echo "  To stop:  $COMPOSE -f docker-compose.production.yml down"
echo "  To logs:  $COMPOSE -f docker-compose.production.yml logs -f"
echo ""
