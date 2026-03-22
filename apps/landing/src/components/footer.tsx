export function Footer() {
  return (
    <footer className="border-t border-border-default px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <p className="text-sm text-text-muted">
          SidClaw &middot; The approval layer for agentic AI
        </p>
        <div className="flex items-center gap-6">
          <a
            href="https://github.com/sidclawhq/platform"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-text-muted transition-colors hover:text-text-secondary"
          >
            GitHub
          </a>
        </div>
        <p className="text-xs text-text-muted">&copy; 2026 SidClaw</p>
      </div>
    </footer>
  );
}
