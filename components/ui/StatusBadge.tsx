type Category = "lifecycle" | "policy" | "approval" | "trace";
type Size = "sm" | "md";

interface StatusBadgeProps {
  label: string;
  category: Category;
  size?: Size;
}

const colorStyles = {
  emerald: "bg-emerald-500/10 text-emerald-400",
  amber: "bg-amber-500/10 text-amber-400",
  red: "bg-red-500/10 text-red-400",
  sky: "bg-sky-500/10 text-sky-400",
} as const;

const sizeStyles: Record<Size, string> = {
  sm: "px-2.5 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
};

function getColorKey(category: Category, label: string): keyof typeof colorStyles {
  const key = label.toLowerCase();

  switch (category) {
    case "lifecycle":
      if (key === "active") return "emerald";
      if (key === "suspended") return "amber";
      if (key === "revoked") return "red";
      break;
    case "policy":
      if (key === "allow") return "emerald";
      if (key === "approval_required") return "amber";
      if (key === "deny") return "red";
      break;
    case "approval":
      if (key === "pending") return "amber";
      if (key === "approved") return "emerald";
      if (key === "denied") return "red";
      break;
    case "trace":
      if (key === "pending") return "amber";
      if (key === "executed") return "emerald";
      if (key === "completed_with_approval") return "sky";
      if (key === "denied") return "red";
      if (key === "blocked") return "red";
      break;
  }

  return "amber";
}

function formatLabel(label: string): string {
  return label
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function StatusBadge({ label, category, size = "sm" }: StatusBadgeProps) {
  const colorKey = getColorKey(category, label);

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeStyles[size]} ${colorStyles[colorKey]}`}
    >
      {formatLabel(label)}
    </span>
  );
}
