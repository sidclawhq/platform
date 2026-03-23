#!/bin/bash
# Pre-commit hook: scan staged files for secrets
# This runs BEFORE lefthook's lint/typecheck hooks

echo "🔒 Scanning for secrets in staged files..."

# Patterns that should NEVER appear in committed files
PATTERNS=(
  "am_us_[a-f0-9]{20,}"           # Agentmail API keys
  "sk_live_[a-zA-Z0-9]{20,}"      # Stripe live secret keys
  "sk_test_[a-zA-Z0-9]{20,}"      # Stripe test secret keys (debatable, but safer)
  "pk_live_[a-zA-Z0-9]{20,}"      # Stripe live publishable keys
  "whsec_[a-zA-Z0-9]{20,}"        # Stripe webhook secrets
  "ghp_[a-zA-Z0-9]{20,}"          # GitHub personal access tokens
  "gho_[a-zA-Z0-9]{20,}"          # GitHub OAuth tokens
  "re_[a-zA-Z0-9]{20,}"           # Resend API keys
  "BEGIN.*PRIVATE KEY"               # Private keys/certificates
  "xoxb-[0-9]"                     # Slack bot tokens
  "xoxp-[0-9]"                     # Slack user tokens
)

FOUND=0

for PATTERN in "${PATTERNS[@]}"; do
  # Check only staged files (what's about to be committed)
  MATCHES=$(git diff --cached --diff-filter=ACMR -U0 | grep -E "^\+" | grep -vE "^\+\+\+" | grep -E "$PATTERN" | grep -v "\.example" | grep -v "placeholder" | grep -v "\.\.\." | grep -v "your_" | grep -v "_here" | grep -v "pre-commit-secret-scan" | grep -v "# Pattern\|# Private\|# Stripe\|# GitHub\|# Slack\|# Resend\|# Agentmail" | head -5)

  if [ -n "$MATCHES" ]; then
    echo ""
    echo "❌ BLOCKED: Potential secret found matching pattern: $PATTERN"
    echo "$MATCHES"
    FOUND=1
  fi
done

if [ $FOUND -eq 1 ]; then
  echo ""
  echo "❌ Commit blocked. Remove secrets before committing."
  echo "   If this is a false positive (e.g., a code example with a placeholder),"
  echo "   use: git commit --no-verify"
  exit 1
fi

echo "✅ No secrets found."
exit 0
