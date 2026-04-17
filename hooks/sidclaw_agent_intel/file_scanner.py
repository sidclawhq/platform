"""Analyze file operations for sensitive paths and traversal attempts."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field


@dataclass
class FileScan:
    path: str
    risk_boost: int
    outside_workspace: bool = False
    sensitive_file: bool = False
    traversal: bool = False
    reasons: list[str] = field(default_factory=list)

    def to_metadata(self) -> dict:
        return {
            "path": self.path,
            "outside_workspace": self.outside_workspace,
            "sensitive_file": self.sensitive_file,
            "traversal": self.traversal,
            "reasons": self.reasons,
        }


_SENSITIVE_NAMES = re.compile(
    r"(?:"
    # dotfiles / known credential filenames anchored to a path separator
    r"(?:^|/)(?:\.env(?:\.[a-z0-9._-]+)?|credentials\.(?:json|ya?ml)|secrets\.ya?ml|id_rsa|id_ed25519|id_ecdsa|id_dsa)$"
    # private-key file extensions anywhere in the basename
    r"|\.(?:pem|key|pfx|p12)$"
    r")",
    re.IGNORECASE,
)

_SENSITIVE_DIRS = (
    "/etc/",
    "/root/",
    "/var/log/",
    ".ssh/",
    ".aws/",
    ".config/",
    "/private/etc/",
)


def scan_file_operation(path: str, workspace: str | None = None) -> FileScan:
    """Inspect a file path for risky attributes.

    `workspace` is typically the user's project root (PWD). Writes outside it
    get a risk boost.
    """
    if not path:
        return FileScan(path="", risk_boost=0)

    expanded = os.path.expanduser(os.path.expandvars(path))
    normalized = os.path.normpath(expanded)

    risk_boost = 0
    reasons: list[str] = []

    traversal = ".." in path.split("/") or "/../" in path
    if traversal:
        risk_boost += 10
        reasons.append("path_traversal")

    outside = False
    if workspace:
        workspace_abs = os.path.abspath(workspace)
        try:
            target_abs = os.path.abspath(normalized)
            outside = not target_abs.startswith(workspace_abs + os.sep) and target_abs != workspace_abs
        except (OSError, ValueError):
            outside = False
        if outside:
            risk_boost += 10
            reasons.append("outside_workspace")

    sensitive_file = False
    if _SENSITIVE_NAMES.search(normalized):
        sensitive_file = True
        risk_boost += 15
        reasons.append("sensitive_filename")
    else:
        for directory in _SENSITIVE_DIRS:
            if directory in normalized:
                sensitive_file = True
                risk_boost += 15
                reasons.append(f"sensitive_dir:{directory.strip('/')}")
                break

    return FileScan(
        path=normalized,
        risk_boost=risk_boost,
        outside_workspace=outside,
        sensitive_file=sensitive_file,
        traversal=traversal,
        reasons=reasons,
    )
