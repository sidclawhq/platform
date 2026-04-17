"""Classify bash commands by intent and detect sensitive path access."""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class BashClassification:
    intent: str                    # readonly | write | destructive | network | deployment | package_mgmt | process_mgmt | credential | unknown
    risk_boost: int                # adjustment to base_risk (can be negative — destructive=+20, etc.)
    sensitive_paths: list[str] = field(default_factory=list)
    destructive_markers: list[str] = field(default_factory=list)
    reversible: bool = True

    def to_metadata(self) -> dict:
        return {
            "intent": self.intent,
            "sensitive_paths": self.sensitive_paths,
            "destructive_markers": self.destructive_markers,
            "reversible": self.reversible,
        }


# Ordered from most to least severe; first match wins.
_INTENT_PATTERNS: list[tuple[str, int, list[str]]] = [
    (
        "credential",
        20,
        [
            r"\b(?:password|token|secret|api[_-]?key)\s*=\s*\S+",
            r"curl\s+[^|]*-[HD]\s*['\"]?(?:authorization|x-api-key)",
        ],
    ),
    (
        "destructive",
        20,
        [
            r"\brm\s+(-\w*f\w*|.*-rf?\b)",
            r"\bgit\s+reset\s+--hard\b",
            r"\bgit\s+push\s+.*--force\b",
            r"\bgit\s+push\s+.*\s+-f\b",
            r"\bgit\s+clean\s+-[df]\w*",
            r"\bdrop\s+(table|database|schema)\b",
            r"\btruncate\s+table\b",
            r"\bdd\s+if=",
            r"\bmkfs\.",
            r">\s*/dev/sd",
            r"\bshred\b",
        ],
    ),
    (
        "deployment",
        15,
        [
            r"\bdocker\s+(push|compose\s+up)\b",
            r"\bkubectl\s+(apply|create|delete|rollout)\b",
            r"\bterraform\s+(apply|destroy|import)\b",
            r"\bhelm\s+(install|upgrade|uninstall)\b",
            r"\bgit\s+push\b",
            r"\bvercel\b",
            r"\brailway\b\s+(up|deploy)\b",
            r"\bnpm\s+publish\b",
            r"\bpnpm\s+publish\b",
            r"\byarn\s+publish\b",
            r"\bpip\s+upload\b",
            r"\btwine\s+upload\b",
        ],
    ),
    (
        "process_mgmt",
        10,
        [
            r"\bkill\s+-9\b",
            r"\bpkill\b",
            r"\bkillall\b",
            r"\bsystemctl\s+(stop|restart|disable)\b",
            r"\blaunchctl\s+(stop|bootout|disable)\b",
        ],
    ),
    (
        "network",
        10,
        [
            r"\bcurl\b",
            r"\bwget\b",
            r"\bssh\b",
            r"\bscp\b",
            r"\brsync\b.*::\b",
            r"\bnc\b\s+",
            r"\bnmap\b",
        ],
    ),
    (
        "package_mgmt",
        5,
        [
            r"\bnpm\s+(install|i|add)\b",
            r"\bpnpm\s+(install|add)\b",
            r"\byarn\s+(add|install)\b",
            r"\bpip\s+install\b",
            r"\bpoetry\s+add\b",
            r"\buv\s+add\b",
            r"\bbrew\s+install\b",
            r"\bapt-get\s+install\b",
        ],
    ),
    (
        "write",
        5,
        [
            r">\s*\S+",                 # redirect
            r">>\s*\S+",
            r"\btee\b",
            r"\btouch\b",
            r"\bmkdir\b",
            r"\bcp\b",
            r"\bmv\b",
            r"\bgit\s+add\b",
            r"\bgit\s+commit\b",
            r"\bln\b",
        ],
    ),
    (
        "readonly",
        0,
        [
            r"^\s*(ls|cat|head|tail|grep|find|fd|rg|wc|stat|file|du|df|pwd|which|echo)\b",
            r"\bgit\s+(status|log|diff|show|branch|blame|remote)\b",
            r"\bdocker\s+ps\b",
            r"\bps\s+",
            r"\btop\b",
            r"\bhtop\b",
        ],
    ),
]

_SENSITIVE_PATH_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("/etc/passwd", re.compile(r"/etc/passwd\b")),
    ("/etc/shadow", re.compile(r"/etc/shadow\b")),
    ("/etc/hosts", re.compile(r"/etc/hosts\b")),
    ("~/.ssh", re.compile(r"(?:~|\$HOME)/\.ssh(?:/|\b)")),
    ("~/.aws", re.compile(r"(?:~|\$HOME)/\.aws(?:/|\b)")),
    ("~/.config", re.compile(r"(?:~|\$HOME)/\.config(?:/|\b)")),
    (".env", re.compile(r"(?:^|[\s=/])(\.env(?:\.[a-z0-9_.-]+)?)(?:\b|$)")),
    ("credentials", re.compile(r"\b(?:credentials\.json|secrets\.ya?ml)\b", re.IGNORECASE)),
    ("private_key", re.compile(r"\.(?:pem|key|pfx)\b")),
    ("traversal", re.compile(r"\.\./\.\./")),
]

_IRREVERSIBLE_MARKERS: list[re.Pattern] = [
    re.compile(r"\brm\s+(-\w*f\w*|.*-rf?\b)"),
    re.compile(r"\bshred\b"),
    re.compile(r"\bdd\s+if="),
    re.compile(r"\bmkfs\."),
    re.compile(r"\bdrop\s+(?:table|database|schema)\b", re.IGNORECASE),
    re.compile(r"\btruncate\s+table\b", re.IGNORECASE),
    re.compile(r"\bgit\s+push\s+.*--force\b"),
    re.compile(r"\bgit\s+reset\s+--hard\b"),
]


def classify_bash(command: str) -> BashClassification:
    """Return intent + risk boost for a bash command.

    Walks the ordered `_INTENT_PATTERNS` and picks the first matching intent.
    Scans sensitive paths and irreversibility markers regardless of intent.
    """
    intent = "unknown"
    risk_boost = 0
    destructive_markers: list[str] = []

    for candidate_intent, boost, patterns in _INTENT_PATTERNS:
        for pattern in patterns:
            if re.search(pattern, command, re.IGNORECASE):
                intent = candidate_intent
                risk_boost = boost
                if candidate_intent == "destructive":
                    destructive_markers.append(pattern)
                break
        if intent != "unknown":
            break

    sensitive_paths: list[str] = []
    for label, pattern in _SENSITIVE_PATH_PATTERNS:
        if pattern.search(command):
            sensitive_paths.append(label)
            risk_boost += 15

    reversible = True
    for pattern in _IRREVERSIBLE_MARKERS:
        if pattern.search(command):
            reversible = False
            risk_boost += 15
            break

    return BashClassification(
        intent=intent,
        risk_boost=risk_boost,
        sensitive_paths=sensitive_paths,
        destructive_markers=destructive_markers,
        reversible=reversible,
    )
