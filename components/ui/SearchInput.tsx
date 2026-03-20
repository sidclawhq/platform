"use client";

interface SearchInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput({ placeholder, value, onChange }: SearchInputProps) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white/[0.03] border border-white/[0.08] rounded-md px-3 py-1.5 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-white/20 w-64 transition-colors"
    />
  );
}
