"use client";

interface PillFilterProps {
  label: string;
  options: string[];
  value: string | null;
  onChange: (value: string | null) => void;
}

function formatLabel(option: string): string {
  return option
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PillFilter({ label, options, value, onChange }: PillFilterProps) {
  return (
    <div className="flex gap-2 items-center">
      <span className="text-xs text-white/40 uppercase tracking-wide mr-2 shrink-0">
        {label}
      </span>
      <button
        onClick={() => onChange(null)}
        className={`px-3 py-1 rounded-full text-xs cursor-pointer transition-colors ${
          value === null
            ? "bg-white/10 text-white/90"
            : "bg-transparent text-white/40 hover:text-white/60"
        }`}
      >
        All
      </button>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`px-3 py-1 rounded-full text-xs cursor-pointer transition-colors ${
            value === option
              ? "bg-white/10 text-white/90"
              : "bg-transparent text-white/40 hover:text-white/60"
          }`}
        >
          {formatLabel(option)}
        </button>
      ))}
    </div>
  );
}
