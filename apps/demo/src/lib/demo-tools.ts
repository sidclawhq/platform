export interface ToolResult {
  success: boolean;
  data: string;
}

export const MOCK_ACCOUNTS: Record<string, Record<string, string | number>> = {
  'A-1234': {
    name: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    type: 'Premium',
    balance: '$12,450.00',
    opened: '2023-06-15',
    last_activity: '2026-03-20',
    support_tier: 'Priority',
    pending_cases: 1,
  },
  'A-5678': {
    name: 'Michael Chen',
    email: 'michael.chen@email.com',
    type: 'Standard',
    balance: '$3,200.00',
    opened: '2024-01-10',
    last_activity: '2026-03-19',
    support_tier: 'Standard',
    pending_cases: 0,
  },
};

export const MOCK_KB_ARTICLES: Record<string, string> = {
  'refund': 'Atlas Financial Refund Policy: Customers may request a full refund within 30 days of any transaction. Refunds are processed within 5-7 business days. For transactions over $5,000, manager approval is required. Contact support@atlas.financial for assistance.',
  'transfer': 'Wire Transfer Guide: Domestic transfers take 1-2 business days. International transfers take 3-5 business days. Daily transfer limit is $25,000 for Standard accounts and $100,000 for Premium accounts.',
  'security': 'Account Security: All accounts are protected by 2FA. Suspicious activity triggers automatic account freeze. Contact security@atlas.financial immediately if you suspect unauthorized access.',
  'fees': 'Fee Schedule: Standard accounts: $0/month. Premium accounts: $29.99/month. Wire transfers: $25 domestic, $45 international. Late payment: $35.',
};

export const MOCK_CASES: Record<string, Record<string, unknown>> = {
  'C-5678': {
    id: 'C-5678',
    customer: 'Sarah Johnson (A-1234)',
    status: 'Open',
    priority: 'High',
    subject: 'Disputed transaction — $1,250 charge on March 15',
    created: '2026-03-18',
    notes: [
      { date: '2026-03-18', author: 'System', text: 'Case created from customer dispute form' },
      { date: '2026-03-19', author: 'Support Agent', text: 'Contacted merchant for transaction details' },
    ],
  },
};

export function searchKnowledgeBase(query: string): ToolResult {
  const queryLower = query.toLowerCase();
  for (const [key, article] of Object.entries(MOCK_KB_ARTICLES)) {
    if (queryLower.includes(key)) {
      return { success: true, data: article };
    }
  }
  return {
    success: true,
    data: `Found 3 articles related to "${query}". The most relevant: Atlas Financial general FAQ — please contact support@atlas.financial for specific inquiries.`,
  };
}

export function lookupAccount(accountId: string): ToolResult {
  const account = MOCK_ACCOUNTS[accountId] ?? MOCK_ACCOUNTS['A-1234'];
  return {
    success: true,
    data: JSON.stringify(account, null, 2),
  };
}

export function sendEmail(to: string, subject: string, body: string): ToolResult {
  return {
    success: true,
    data: `Email sent successfully to ${to}.\nSubject: ${subject}\nBody preview: ${body.substring(0, 100)}...`,
  };
}

export function updateCase(caseId: string, notes: string): ToolResult {
  return {
    success: true,
    data: `Case ${caseId} updated with note: "${notes}". Status remains Open. Timestamp: ${new Date().toISOString()}`,
  };
}

export function exportData(): ToolResult {
  return { success: false, data: 'Export blocked by policy' };
}

export function closeAccount(): ToolResult {
  return { success: false, data: 'Account closure blocked by policy' };
}
