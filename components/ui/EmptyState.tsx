interface EmptyStateProps {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="py-16 text-center">
      <div className="text-lg font-medium text-white/60">{title}</div>
      <div className="text-sm text-white/40 mt-2 max-w-md mx-auto">{body}</div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 text-sm text-white/60 border border-white/[0.1] rounded-md hover:bg-white/[0.05] transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
