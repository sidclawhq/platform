interface StatCardProps {
  value: number | string;
  label: string;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneBorderClass: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "border-l-2 border-l-white/[0.1]",
  success: "border-l-2 border-l-emerald-500/40",
  warning: "border-l-2 border-l-amber-500/40",
  danger: "border-l-2 border-l-red-500/40",
};

export function StatCard({ value, label, tone = "default" }: StatCardProps) {
  return (
    <div
      className={`bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 ${toneBorderClass[tone]}`}
    >
      <div className="text-2xl font-semibold text-white/90">{value}</div>
      <div className="text-xs text-white/40 mt-1 uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}
