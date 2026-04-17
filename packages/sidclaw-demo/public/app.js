// Client-side rendering for the SidClaw demo approval dashboard.
// Vanilla ES modules, no framework, no build step.

const listEl = document.getElementById('scenario-list');
const detailEl = document.getElementById('detail');
const pendingCountEl = document.getElementById('pending-count');

let scenarios = [];
let activeId = null;

function esc(value) {
  const s = String(value ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function renderSidebar() {
  const pending = scenarios.filter((s) => s.status === 'pending').length;
  pendingCountEl.textContent = `${pending} pending · ${scenarios.length} total`;

  listEl.innerHTML = scenarios
    .map(
      (s) => `
      <li class="scenario-card ${activeId === s.id ? 'active' : ''}" data-id="${esc(s.id)}">
        <div class="scenario-title">
          <span class="status-pill ${esc(s.status)}">${esc(s.status)}</span>
          <span>${esc(shortTitle(s))}</span>
        </div>
        <div class="scenario-meta">${esc(s.action.operation)} · risk ${s.risk_score}</div>
        <div class="scenario-agent">${esc(s.agent.name)}</div>
      </li>
    `,
    )
    .join('');
  for (const card of listEl.querySelectorAll('.scenario-card')) {
    card.addEventListener('click', () => {
      activeId = card.dataset.id;
      render();
    });
  }
}

function shortTitle(scenario) {
  return scenario.action.declared_goal.length > 60
    ? scenario.action.declared_goal.slice(0, 57) + '…'
    : scenario.action.declared_goal;
}

function renderDetail() {
  const scenario = scenarios.find((s) => s.id === activeId);
  if (!scenario) {
    detailEl.innerHTML = `
      <div class="empty-state">
        <h2>Pick a pending approval.</h2>
        <p>This demo shows the exact approval card your reviewers see in production, with real policy context, risk scoring, and the tamper-evident trace.</p>
      </div>`;
    return;
  }

  const actionButtons = scenario.status === 'pending' && scenario.interactive
    ? `
      <div class="actions">
        <button class="btn btn-approve" data-action="approved">Approve</button>
        <button class="btn btn-deny" data-action="denied">Deny</button>
      </div>`
    : scenario.decision
      ? `
        <div class="decision-block ${esc(scenario.decision.status)}">
          <div class="decision-label ${esc(scenario.decision.status)}">${scenario.decision.status === 'approved' ? '✓ Approved' : '✕ Denied'}</div>
          <div class="decision-note">${esc(scenario.decision.note)}</div>
          <div class="decision-meta">${esc(scenario.decision.approver_name)} · ${formatRelative(scenario.decision.decided_at)}</div>
        </div>`
      : '';

  detailEl.innerHTML = `
    <article class="approval-card">
      <header class="card-header">
        <div>
          <div class="card-title">${esc(scenario.action.declared_goal)}</div>
          <div class="card-subtitle">${esc(scenario.agent.name)} (${esc(scenario.agent.owner)})</div>
          <div class="card-id">approval_id: ${esc(scenario.id)}</div>
        </div>
        <div class="risk-badge ${esc(scenario.risk_classification)}">
          ${esc(scenario.risk_classification)} · risk ${scenario.risk_score}
        </div>
      </header>

      <section class="section">
        <div class="section-label">Request summary</div>
        <div class="kv-grid">
          <div class="kv-cell">
            <div class="kv-label">Operation</div>
            <div class="kv-value">${esc(scenario.action.operation)}</div>
          </div>
          <div class="kv-cell">
            <div class="kv-label">Target integration</div>
            <div class="kv-value">${esc(scenario.action.target_integration)}</div>
          </div>
          <div class="kv-cell">
            <div class="kv-label">Resource scope</div>
            <div class="kv-value">${esc(scenario.action.resource_scope)}</div>
          </div>
          <div class="kv-cell">
            <div class="kv-label">Data classification</div>
            <div class="kv-value">${esc(scenario.action.data_classification)}</div>
          </div>
          <div class="kv-cell">
            <div class="kv-label">Agent environment</div>
            <div class="kv-value">${esc(scenario.agent.environment)}</div>
          </div>
          <div class="kv-cell">
            <div class="kv-label">Requested</div>
            <div class="kv-value">${esc(formatRelative(scenario.requested_at))}</div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-label">Why this was flagged</div>
        <div class="flag-box">
          <div class="flag-label">Policy: ${esc(scenario.policy.name)}</div>
          <div class="flag-text">${esc(scenario.flag_reason)}</div>
          <div class="flag-text" style="color: var(--text-muted); margin-top: 8px; font-size: 12px;">${esc(scenario.policy.rationale)}</div>
        </div>
      </section>

      <section class="section">
        <div class="section-label">Raw action payload</div>
        <pre class="payload">${esc(JSON.stringify(scenario.action.raw_payload, null, 2))}</pre>
      </section>

      <section class="section">
        <div class="section-label">Trace so far</div>
        <ul class="trace">
          ${scenario.trace_events
            .map(
              (e) => `
              <li class="trace-event ${esc(e.status)}">
                <div class="trace-type">${esc(humanize(e.type))}</div>
                <div class="trace-meta">${esc(e.actor)} · +${e.offset_ms}ms · ${esc(e.status)}</div>
              </li>`,
            )
            .join('')}
        </ul>
      </section>

      ${actionButtons}
    </article>
  `;

  for (const btn of detailEl.querySelectorAll('.btn[data-action]')) {
    btn.addEventListener('click', async () => {
      await decide(scenario.id, btn.dataset.action);
    });
  }
}

function humanize(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function decide(id, decision) {
  const approverPrompt = 'Optional note for the audit trail (leave blank for default)';
  const note = window.prompt(approverPrompt) || undefined;
  try {
    const res = await fetch(`/api/scenarios/${id}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, note }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`Error: ${data.error || 'unknown'}`);
      return;
    }
    scenarios = scenarios.map((s) => (s.id === id ? data : s));
    render();
  } catch (e) {
    alert(`Request failed: ${e.message}`);
  }
}

async function loadScenarios() {
  const res = await fetch('/api/scenarios');
  const data = await res.json();
  scenarios = data.scenarios;
  // Default to the first pending scenario for instant context
  activeId = (scenarios.find((s) => s.status === 'pending') || scenarios[0]).id;
  render();
}

function render() {
  renderSidebar();
  renderDetail();
}

loadScenarios().catch((err) => {
  detailEl.innerHTML = `<div class="empty-state"><h2>Demo failed to load</h2><p>${esc(err.message)}</p></div>`;
});
