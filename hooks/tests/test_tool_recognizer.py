from sidclaw_agent_intel.tool_recognizer import classify_tool, is_governed


def test_bash_is_governed_with_high_base_risk():
    result = classify_tool("Bash")
    assert result.governed is True
    assert result.base_risk == 70
    assert result.category == "execution"


def test_read_is_not_governed():
    assert is_governed("Read") is False
    assert classify_tool("Read").base_risk == 5


def test_write_is_file_io_with_workspace_write_permission():
    result = classify_tool("Write")
    assert result.category == "file_io"
    assert result.permission_level == "workspace_write"
    assert result.governed is True


def test_mcp_tools_default_to_governed_with_medium_risk():
    result = classify_tool("mcp__postgres__query")
    assert result.category == "mcp"
    assert result.governed is True
    assert result.base_risk == 50


def test_unknown_tools_default_conservatively():
    result = classify_tool("NewMysteryTool")
    assert result.governed is True
    assert result.category == "unknown"
    assert result.base_risk == 40


def test_orchestration_tools_are_high_risk():
    for name in ("Agent", "Skill", "RemoteTrigger", "CronCreate", "TeamCreate"):
        assert classify_tool(name).category == "orchestration"
        assert classify_tool(name).base_risk >= 50
