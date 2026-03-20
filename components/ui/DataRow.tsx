import { ReactNode } from "react";

interface DataRowProps {
  label: string;
  value: string | ReactNode;
  mono?: boolean;
}

export function DataRow({ label, value, mono }: DataRowProps) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-2 py-1.5">
      <dt className="text-sm text-white/40 font-medium">{label}</dt>
      <dd className={`text-sm text-white/80${mono ? " font-mono-trace" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
