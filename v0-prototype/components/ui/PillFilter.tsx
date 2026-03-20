"use client";

type FilterOption = string | { value: string; label: string };

interface PillFilterProps {
  label: string;
  options: FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}

function formatLabel(option: string): string {
  return option
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeOption(option: FilterOption) {
  if (typeof option === "string") {
    return {
      value: option,
      label: formatLabel(option),
    };
  }

  return option;
}

export function PillFilter({ label, options, value, onChange }: PillFilterProps) {
  return (
    <select
      value={value ?? "__all__"}
      onChange={(e) => onChange(e.target.value === "__all__" ? null : e.target.value)}
      className="h-8 cursor-pointer rounded border border-border bg-surface-1 px-2 text-[12px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value="__all__">{label}: All</option>
      {options.map((option) => {
        const normalized = normalizeOption(option);

        return (
        <option key={normalized.value} value={normalized.value}>
          {normalized.label}
        </option>
        );
      })}
    </select>
  );
}
