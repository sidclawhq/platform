import { cn } from "@/lib/utils";

type Category =
  | "lifecycle"
  | "policy"
  | "approval"
  | "trace"
  | "autonomy"
  | "authority"
  | "classification";
type Size = "sm" | "md";

interface StatusBadgeProps {
  label: string;
  category: Category;
  size?: Size;
  className?: string;
}

const sizeStyles: Record<Size, string> = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-[12px]",
};

function toTitle(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLabel(category: Category, label: string): string {
  const value = label.toLowerCase();

  if (category === "policy") {
    if (value === "allow") return "Allowed";
    if (value === "approval_required") return "Approval Required";
    if (value === "deny") return "Denied";
  }

  if (category === "trace") {
    if (value === "completed_with_approval") return "Completed with approval";
  }

  return toTitle(label);
}

const categoryStyles: Record<Category, Record<string, string>> = {
  lifecycle: {
    Active: "bg-status-active/10 text-status-active",
    Suspended: "bg-status-suspended/10 text-status-suspended",
    Revoked: "bg-status-revoked/10 text-status-revoked",
  },
  policy: {
    Allowed: "bg-status-allowed/10 text-status-allowed",
    "Approval Required": "bg-status-approval/10 text-status-approval",
    Denied: "bg-status-denied/10 text-status-denied",
  },
  approval: {
    Pending: "bg-status-pending/10 text-status-pending",
    Approved: "bg-status-allowed/10 text-status-allowed",
    Denied: "bg-status-denied/10 text-status-denied",
  },
  trace: {
    Pending: "bg-status-pending/10 text-status-pending",
    Executed: "bg-status-executed/10 text-status-executed",
    "Completed with approval": "bg-status-allowed/10 text-status-allowed",
    Denied: "bg-status-denied/10 text-status-denied",
    Blocked: "bg-status-blocked/10 text-status-blocked",
  },
  autonomy: {
    Low: "bg-surface-2 text-muted-foreground",
    Medium: "bg-status-approval/10 text-status-approval",
    High: "bg-status-denied/10 text-status-denied",
  },
  authority: {
    Self: "bg-surface-2 text-muted-foreground",
    Delegated: "bg-status-approval/10 text-status-approval",
    Hybrid: "bg-surface-3 text-secondary-foreground",
  },
  classification: {
    Public: "bg-surface-2 text-muted-foreground",
    Internal: "bg-surface-2 text-muted-foreground",
    Confidential: "bg-status-approval/10 text-status-approval",
    Restricted: "bg-status-denied/10 text-status-denied",
  },
};

export function StatusBadge({
  label,
  category,
  size = "sm",
  className,
}: StatusBadgeProps) {
  const displayLabel = formatLabel(category, label);
  const styles =
    categoryStyles[category][displayLabel] ?? "bg-surface-2 text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded font-medium uppercase tracking-wide",
        sizeStyles[size],
        styles,
        className
      )}
    >
      {displayLabel}
    </span>
  );
}
