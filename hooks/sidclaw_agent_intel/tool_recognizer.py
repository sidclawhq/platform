"""Catalog of Claude Code tools with risk profiles."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ToolClassification:
    tool_name: str
    category: str
    governed: bool
    base_risk: int
    permission_level: str  # safe | workspace_write | prompt | danger | varies

    def to_dict(self) -> dict:
        return {
            "tool_name": self.tool_name,
            "category": self.category,
            "governed": self.governed,
            "base_risk": self.base_risk,
            "permission_level": self.permission_level,
        }


_CATALOG: dict[str, ToolClassification] = {
    # execution — highest blast radius
    "Bash": ToolClassification("Bash", "execution", True, 70, "danger"),
    # file_io — workspace writes
    "Edit": ToolClassification("Edit", "file_io", True, 35, "workspace_write"),
    "Write": ToolClassification("Write", "file_io", True, 40, "workspace_write"),
    "MultiEdit": ToolClassification("MultiEdit", "file_io", True, 40, "workspace_write"),
    "NotebookEdit": ToolClassification("NotebookEdit", "file_io", True, 35, "workspace_write"),
    # orchestration — agents, skills, remote triggers
    "Agent": ToolClassification("Agent", "orchestration", True, 75, "danger"),
    "Skill": ToolClassification("Skill", "orchestration", True, 60, "danger"),
    "RemoteTrigger": ToolClassification("RemoteTrigger", "orchestration", True, 70, "danger"),
    "CronCreate": ToolClassification("CronCreate", "orchestration", True, 55, "danger"),
    "CronDelete": ToolClassification("CronDelete", "orchestration", True, 50, "danger"),
    "CronList": ToolClassification("CronList", "search", False, 5, "safe"),
    "TeamCreate": ToolClassification("TeamCreate", "orchestration", True, 65, "danger"),
    "TeamDelete": ToolClassification("TeamDelete", "orchestration", True, 65, "danger"),
    "SendMessage": ToolClassification("SendMessage", "interactive", True, 10, "prompt"),
    # system — task bookkeeping, safe
    "TaskCreate": ToolClassification("TaskCreate", "system", False, 10, "safe"),
    "TaskUpdate": ToolClassification("TaskUpdate", "system", False, 10, "safe"),
    "TaskList": ToolClassification("TaskList", "system", False, 5, "safe"),
    "TaskGet": ToolClassification("TaskGet", "system", False, 5, "safe"),
    "TaskStop": ToolClassification("TaskStop", "system", False, 10, "safe"),
    "TaskOutput": ToolClassification("TaskOutput", "system", False, 5, "safe"),
    # search — read-only
    "Read": ToolClassification("Read", "search", False, 5, "safe"),
    "Glob": ToolClassification("Glob", "search", False, 5, "safe"),
    "Grep": ToolClassification("Grep", "search", False, 5, "safe"),
    "WebSearch": ToolClassification("WebSearch", "search", False, 10, "safe"),
    "WebFetch": ToolClassification("WebFetch", "search", False, 15, "safe"),
    "LSP": ToolClassification("LSP", "search", False, 5, "safe"),
    # interactive
    "AskUserQuestion": ToolClassification("AskUserQuestion", "interactive", False, 10, "safe"),
    # planning
    "EnterPlanMode": ToolClassification("EnterPlanMode", "system", False, 5, "safe"),
    "ExitPlanMode": ToolClassification("ExitPlanMode", "system", False, 5, "safe"),
    # worktrees — mutates the filesystem in a contained way
    "EnterWorktree": ToolClassification("EnterWorktree", "file_io", True, 30, "workspace_write"),
    "ExitWorktree": ToolClassification("ExitWorktree", "file_io", True, 20, "workspace_write"),
    # schedule / trigger
    "ScheduleWakeup": ToolClassification("ScheduleWakeup", "orchestration", True, 30, "prompt"),
    "PushNotification": ToolClassification("PushNotification", "interactive", True, 20, "prompt"),
}


def classify_tool(tool_name: str) -> ToolClassification:
    """Return the classification for a tool name.

    MCP tools (prefixed `mcp__`) fall into the `mcp` category with base risk 50.
    Unknown tools default to the `unknown` category with conservative risk 40.
    """
    if tool_name in _CATALOG:
        return _CATALOG[tool_name]

    if tool_name.startswith("mcp__"):
        return ToolClassification(tool_name, "mcp", True, 50, "varies")

    # Unknown Claude Code tool — conservative default
    return ToolClassification(tool_name, "unknown", True, 40, "prompt")


def is_governed(tool_name: str) -> bool:
    return classify_tool(tool_name).governed
