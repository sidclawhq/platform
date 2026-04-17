from sidclaw_agent_intel.bash_classifier import classify_bash


def test_ls_is_readonly():
    result = classify_bash("ls -la")
    assert result.intent == "readonly"
    assert result.risk_boost == 0
    assert result.reversible is True
    assert result.sensitive_paths == []


def test_rm_rf_is_destructive_and_irreversible():
    result = classify_bash("rm -rf ./data")
    assert result.intent == "destructive"
    assert result.risk_boost >= 35  # +20 destructive + +15 irreversible
    assert result.reversible is False
    assert len(result.destructive_markers) >= 1


def test_git_push_is_deployment():
    result = classify_bash("git push origin main")
    assert result.intent == "deployment"
    assert result.risk_boost == 15


def test_git_push_force_is_destructive_not_deployment():
    result = classify_bash("git push --force origin main")
    assert result.intent == "destructive"
    assert result.reversible is False


def test_drop_table_is_destructive():
    result = classify_bash("psql -c 'DROP TABLE users'")
    assert result.intent == "destructive"
    assert result.reversible is False


def test_sensitive_path_boosts_risk():
    result = classify_bash("cat ~/.ssh/id_rsa")
    assert "~/.ssh" in result.sensitive_paths
    assert result.risk_boost >= 15


def test_env_file_is_sensitive():
    result = classify_bash("cat .env.production")
    assert any(".env" in p for p in result.sensitive_paths)


def test_curl_is_network():
    result = classify_bash("curl https://example.com")
    assert result.intent == "network"


def test_npm_install_is_package_mgmt():
    result = classify_bash("npm install express")
    assert result.intent == "package_mgmt"
    assert result.risk_boost == 5


def test_kubectl_apply_is_deployment():
    result = classify_bash("kubectl apply -f deploy.yaml")
    assert result.intent == "deployment"


def test_write_redirect_is_write():
    result = classify_bash("echo 'hi' > file.txt")
    assert result.intent == "write"


def test_risk_boost_stacks_for_destructive_on_sensitive_path():
    result = classify_bash("rm -rf ~/.ssh/known_hosts")
    # destructive(+20) + irreversible(+15) + sensitive(+15) = 50 minimum
    assert result.risk_boost >= 50
