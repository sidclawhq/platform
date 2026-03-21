'use client';

interface PolicyVersionDiffProps {
  changeSummary: string | null;
}

/**
 * Parses a change_summary string like:
 *   "policy_effect: 'allow' → 'approval_required'; priority: '50' → '100'"
 * into individual change entries.
 */
function parseChanges(summary: string): Array<{ field: string; oldValue: string; newValue: string }> {
  return summary.split('; ').map((part) => {
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) return { field: part.trim(), oldValue: '', newValue: '' };

    const field = part.slice(0, colonIndex).trim();
    const rest = part.slice(colonIndex + 1).trim();

    const arrowIndex = rest.indexOf('→');
    if (arrowIndex === -1) return { field, oldValue: rest, newValue: '' };

    const oldValue = rest.slice(0, arrowIndex).trim().replace(/^'|'$/g, '');
    const newValue = rest.slice(arrowIndex + 1).trim().replace(/^'|'$/g, '');

    return { field, oldValue, newValue };
  });
}

export function PolicyVersionDiff({ changeSummary }: PolicyVersionDiffProps) {
  if (!changeSummary || changeSummary === 'No changes detected') {
    return null;
  }

  const changes = parseChanges(changeSummary);

  return (
    <div className="mt-2 space-y-1">
      {changes.map((change, i) => (
        <div key={i} className="text-sm">
          <span className="text-text-muted">{change.field}: </span>
          {change.oldValue && (
            <span className="text-accent-red line-through">{change.oldValue}</span>
          )}
          {change.oldValue && change.newValue && (
            <span className="text-text-muted mx-1">&rarr;</span>
          )}
          {change.newValue && (
            <span className="text-accent-green">{change.newValue}</span>
          )}
        </div>
      ))}
    </div>
  );
}
