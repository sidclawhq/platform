interface EmptyStateProps {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="py-16 text-center">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">{body}</div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-3 text-[13px] font-medium text-foreground underline underline-offset-2 transition-opacity hover:opacity-80"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
