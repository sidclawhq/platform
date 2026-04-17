# @sidclaw/cli

Terminal CLI for SidClaw approvals. Review and decide without opening a
browser. MIT licensed.

## Install

```bash
npx @sidclaw/cli help
```

## Use

```bash
export SIDCLAW_BASE_URL=https://api.sidclaw.com
export SIDCLAW_API_KEY=ai_your_key

# Interactive picker — arrow keys to select, A/D to decide
sidclaw approvals

# Non-interactive list — CI-friendly
sidclaw approvals list

# Continuous watch with desktop notifications
sidclaw approvals --watch
```

## Keys (interactive)

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move cursor |
| `Enter` | Show full approval JSON |
| `A` | Approve (prompts for note) |
| `D` | Deny (prompts for note) |
| `Q` / `Ctrl+C` | Quit |

## Design

Zero dependencies — pure Node stdlib. Works on any Node 18+ install
without `npm install`. Desktop notifications on macOS (osascript) and
Linux (notify-send), terminal bell fallback everywhere else.
