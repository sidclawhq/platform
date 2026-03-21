interface ApprovalContextSnapshotProps {
  context: Record<string, unknown>;
}

export function ApprovalContextSnapshot({ context }: ApprovalContextSnapshotProps) {
  const formatted = JSON.stringify(context, null, 2);

  return (
    <pre className="max-h-[300px] overflow-y-auto overflow-x-auto rounded bg-surface-2 p-4 font-mono text-xs">
      {formatted.split('\n').map((line, i) => {
        const match = line.match(/^(\s*)"([^"]+)":/);
        if (match) {
          const indent = match[1];
          const key = match[2];
          const rest = line.slice(match[0].length);
          return (
            <span key={i}>
              {indent}<span className="text-text-muted">&quot;{key}&quot;</span>:{' '}
              <span className="text-text-secondary">{rest.trim()}</span>
              {'\n'}
            </span>
          );
        }
        return (
          <span key={i} className="text-text-secondary">
            {line}
            {'\n'}
          </span>
        );
      })}
    </pre>
  );
}
