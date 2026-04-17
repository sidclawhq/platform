import os
import tempfile

from sidclaw_agent_intel.file_scanner import scan_file_operation


def test_empty_path_returns_zero_risk():
    result = scan_file_operation("")
    assert result.risk_boost == 0


def test_env_file_is_sensitive():
    result = scan_file_operation("/project/.env.production")
    assert result.sensitive_file is True
    assert "sensitive_filename" in result.reasons
    assert result.risk_boost >= 15


def test_ssh_key_is_sensitive():
    result = scan_file_operation("/home/user/.ssh/id_rsa")
    assert result.sensitive_file is True


def test_traversal_detected():
    result = scan_file_operation("../../../etc/passwd")
    assert result.traversal is True


def test_outside_workspace_flagged():
    with tempfile.TemporaryDirectory() as workspace:
        result = scan_file_operation("/tmp/other-file.txt", workspace=workspace)
        assert result.outside_workspace is True


def test_inside_workspace_not_flagged():
    with tempfile.TemporaryDirectory() as workspace:
        inside = os.path.join(workspace, "src", "file.py")
        result = scan_file_operation(inside, workspace=workspace)
        assert result.outside_workspace is False


def test_pem_file_is_sensitive():
    result = scan_file_operation("/workspace/private.pem")
    assert result.sensitive_file is True
