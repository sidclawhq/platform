export function ApprovalDemo() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          See exactly what your agent wants to do — and decide
        </h2>
        <p className="mt-4 text-center text-sm text-text-secondary">
          Every high-risk action surfaces a context-rich approval card.
          One&nbsp;click to approve or deny.
        </p>
        <div className="mt-12">
          {/* Realistic mock of the approval panel UI */}
          <div className="mx-auto max-w-2xl rounded-lg border border-border-default bg-surface-1 shadow-2xl">
            {/* Window chrome */}
            <div className="flex items-center gap-1.5 border-b border-border-default px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-text-muted/30" />
              <span className="h-2.5 w-2.5 rounded-full bg-text-muted/30" />
              <span className="h-2.5 w-2.5 rounded-full bg-text-muted/30" />
              <span className="ml-4 text-xs text-text-muted">
                Approval Request
              </span>
            </div>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-accent-amber/10 px-2 py-0.5 text-xs font-medium text-accent-amber">
                      HIGH
                    </span>
                    <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-muted">
                      PENDING
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-text-primary">
                    send_email <span className="font-normal text-text-muted">&rarr;</span> email_service
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">
                    Customer Communications Agent
                  </p>
                </div>
                <span className="font-mono text-xs text-text-muted">
                  2m ago
                </span>
              </div>
              {/* Resource */}
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs text-text-muted">Resource:</span>
                <span className="font-mono text-xs text-text-secondary">customer_emails</span>
                <span className="rounded bg-accent-amber/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-amber">
                  confidential
                </span>
              </div>
              {/* Flagged section */}
              <div className="mt-4 rounded border-l-2 border-accent-amber bg-accent-amber/5 p-3">
                <p className="text-xs text-text-secondary">
                  Outbound customer communications require human review before sending to ensure compliance with FINRA communication standards and data handling policies.
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-[10px] text-text-muted">
                    Policy: <span className="text-text-secondary">Outbound customer email review</span>
                  </span>
                  <span className="text-[10px] text-text-muted">
                    Version: <span className="font-mono text-text-secondary">v1</span>
                  </span>
                </div>
              </div>
              {/* Context snapshot */}
              <div className="mt-4 rounded border border-border-default bg-surface-0 p-4">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  Context Snapshot
                </p>
                <pre className="mt-2 font-mono text-xs text-text-secondary leading-relaxed">
{`{
  "recipient": "maria.chen@atlasfinancial.com",
  "subject": "Q4 Portfolio Rebalancing Summary",
  "reason": "Quarterly client portfolio update"
}`}
                </pre>
              </div>
              {/* Action buttons */}
              <div className="mt-6 flex gap-3">
                <button className="flex-1 rounded-lg bg-accent-green/10 py-2.5 text-sm font-medium text-accent-green">
                  Approve
                </button>
                <button className="flex-1 rounded-lg bg-accent-red/10 py-2.5 text-sm font-medium text-accent-red">
                  Deny
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
