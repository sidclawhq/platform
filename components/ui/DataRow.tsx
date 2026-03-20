import { ReactNode } from "react";

interface DataRowProps {
  label: string;
  value: string | ReactNode;
  mono?: boolean;
}

export function DataRow({ label, value, mono }: DataRowProps) {
  return (
    <div className="grid grid-cols-[minmax(120px,180px)_1fr] gap-3 py-1.5">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className={`text-[13px] text-foreground${mono ? " font-mono-trace" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
