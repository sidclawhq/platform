export function DemoHeader() {
  return (
    <header className="flex items-center justify-between border-b border-[#2A2A2E] px-6 py-3">
      <div className="flex items-center gap-4">
        <span className="text-base font-semibold text-[#E4E4E7]">SidClaw</span>
        <span className="rounded bg-[#3B82F6]/10 px-2 py-0.5 text-sm font-medium text-[#3B82F6]">
          Interactive Demo
        </span>
      </div>
      <div className="flex items-center gap-4">
        <a href="https://docs.sidclaw.com" target="_blank" rel="noopener noreferrer" className="text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">
          Docs
        </a>
        <a href="https://github.com/sidclawhq/platform" target="_blank" rel="noopener noreferrer" className="text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">
          GitHub
        </a>
        <a href="https://app.sidclaw.com/signup" className="rounded bg-[#3B82F6] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#3B82F6]/90">
          Get Started Free
        </a>
      </div>
    </header>
  );
}
