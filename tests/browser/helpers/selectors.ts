// Centralized selectors — update here when UI changes instead of across all tests

export const selectors = {
  // Navigation
  sidebar: {
    overview: 'a[href="/dashboard"]',
    agents: 'a[href="/dashboard/agents"]',
    policies: 'a[href="/dashboard/policies"]',
    approvals: 'a[href="/dashboard/approvals"]',
    audit: 'a[href="/dashboard/audit"]',
    architecture: 'a[href="/dashboard/architecture"]',
    settings: 'a[href="/dashboard/settings"]',
    pendingBadge: '[data-testid="pending-approval-badge"]',
  },

  // Auth
  auth: {
    nameInput: 'input[name="name"]',
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button[type="submit"]',
    githubButton: '[data-testid="github-oauth"]',
    googleButton: '[data-testid="google-oauth"]',
    logoutButton: '[data-testid="logout"]',
  },

  // Agents
  agents: {
    createButton: '[data-testid="create-agent"]',
    table: '[data-testid="agent-table"]',
    row: '[data-testid="agent-row"]',
    nameInput: 'input[name="name"]',
    descriptionInput: 'textarea[name="description"]',
    ownerNameInput: 'input[name="owner_name"]',
    ownerRoleInput: 'input[name="owner_role"]',
    teamInput: 'input[name="team"]',
    suspendButton: '[data-testid="suspend-agent"]',
    revokeButton: '[data-testid="revoke-agent"]',
    reactivateButton: '[data-testid="reactivate-agent"]',
    confirmDialog: '[data-testid="confirm-dialog"]',
    confirmButton: '[data-testid="confirm-action"]',
    lifecycleBadge: '[data-testid="lifecycle-badge"]',
  },

  // Policies
  policies: {
    createButton: '[data-testid="create-policy"]',
    card: '[data-testid="policy-card"]',
    editButton: '[data-testid="edit-policy"]',
    deactivateButton: '[data-testid="deactivate-policy"]',
    testButton: '[data-testid="test-policy"]',
    historyButton: '[data-testid="policy-history"]',
    effectBadge: '[data-testid="effect-badge"]',
    editorModal: '[data-testid="policy-editor"]',
    testModal: '[data-testid="policy-test-modal"]',
    testResult: '[data-testid="policy-test-result"]',
  },

  // Approvals
  approvals: {
    queueCard: '[data-testid="approval-card"]',
    detailPanel: '[data-testid="approval-detail"]',
    approveButton: '[data-testid="approve-button"]',
    denyButton: '[data-testid="deny-button"]',
    noteInput: '[data-testid="reviewer-note"]',
    riskBadge: '[data-testid="risk-badge"]',
    staleBadge: '[data-testid="stale-badge"]',
    whyFlagged: '[data-testid="why-flagged"]',
    sortDropdown: '[data-testid="sort-dropdown"]',
  },

  // Traces
  traces: {
    list: '[data-testid="trace-list"]',
    listItem: '[data-testid="trace-item"]',
    detail: '[data-testid="trace-detail"]',
    eventTimeline: '[data-testid="event-timeline"]',
    eventRow: '[data-testid="event-row"]',
    exportJsonButton: '[data-testid="export-json"]',
    exportCsvButton: '[data-testid="export-csv"]',
    integrityBadge: '[data-testid="integrity-badge"]',
    outcomeBadge: '[data-testid="outcome-badge"]',
  },

  // Settings
  settings: {
    generalTab: 'a[href="/dashboard/settings/general"]',
    usersTab: 'a[href="/dashboard/settings/users"]',
    apiKeysTab: 'a[href="/dashboard/settings/api-keys"]',
    webhooksTab: 'a[href="/dashboard/settings/webhooks"]',
    auditExportTab: 'a[href="/dashboard/settings/audit-export"]',
    saveButton: '[data-testid="save-settings"]',
    createKeyButton: '[data-testid="create-api-key"]',
    keyDialog: '[data-testid="api-key-dialog"]',
    rawKeyValue: '[data-testid="raw-key-value"]',
    rotateKeyButton: '[data-testid="rotate-key"]',
    deleteKeyButton: '[data-testid="delete-key"]',
  },

  // Search
  search: {
    input: '[data-testid="global-search"]',
    results: '[data-testid="search-results"]',
    resultItem: '[data-testid="search-result-item"]',
  },

  // Common
  common: {
    toast: '[data-sonner-toast]',
    loadingSpinner: '[data-testid="loading"]',
    emptyState: '[data-testid="empty-state"]',
    breadcrumbs: '[data-testid="breadcrumbs"]',
  },
};
