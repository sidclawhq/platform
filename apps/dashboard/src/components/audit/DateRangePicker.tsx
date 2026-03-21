"use client";

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        className="h-8 rounded-md border border-border bg-surface-1 px-2 font-mono text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent-blue"
        placeholder="From"
      />
      <span className="text-xs text-text-muted">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        className="h-8 rounded-md border border-border bg-surface-1 px-2 font-mono text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent-blue"
        placeholder="To"
      />
    </div>
  );
}
