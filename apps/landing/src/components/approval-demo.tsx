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
                      HIGH RISK
                    </span>
                    <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-muted">
                      PENDING
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-text-primary">
                    database.execute_query
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">
                    Customer Communications Agent
                  </p>
                </div>
                <span className="font-mono text-xs text-text-muted">
                  2m ago
                </span>
              </div>
              {/* Context snapshot */}
              <div className="mt-5 rounded border border-border-default bg-surface-0 p-4">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  Action Context
                </p>
                <div className="mt-2 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-text-muted">Query type</span>
                    <span className="font-mono text-xs text-text-secondary">
                      DELETE
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-text-muted">Table</span>
                    <span className="font-mono text-xs text-text-secondary">
                      customer_records
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-text-muted">
                      Rows affected
                    </span>
                    <span className="font-mono text-xs text-accent-amber">
                      1,247
                    </span>
                  </div>
                </div>
              </div>
              {/* Flagged items */}
              <div className="mt-4 rounded border border-accent-amber/30 bg-accent-amber/5 p-3">
                <p className="text-xs font-medium text-accent-amber">
                  Flagged: Bulk DELETE on production table
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  This operation will permanently remove 1,247 customer records.
                  Policy requires human approval for destructive operations
                  affecting &gt;100 rows.
                </p>
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
