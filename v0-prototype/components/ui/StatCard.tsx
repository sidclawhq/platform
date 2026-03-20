interface StatCardProps {
  value: number | string;
  label: string;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneClass: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-surface-2 border-border",
  success: "bg-status-allowed/8 border-status-allowed/25",
  warning: "bg-status-approval/8 border-status-approval/25",
  danger: "bg-status-denied/8 border-status-denied/25",
};

export function StatCard({ value, label, tone = "default" }: StatCardProps) {
  return (
    <div className={`rounded border p-3 ${toneClass[tone]}`}>
      <div className="text-lg font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
