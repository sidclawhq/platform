export function DemoFooter() {
  return (
    <footer className="border-t border-[#2A2A2E] px-6 py-3 flex items-center justify-between">
      <div className="text-xs text-[#71717A]">
        This demo uses <span className="text-[#A1A1AA]">real SidClaw governance</span> — the policy evaluation, approval workflow, and audit traces are 100% authentic.
        Only the business data (accounts, emails) is simulated.
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-[#71717A]">Ready to govern your agents?</span>
        <a href="https://app.sidclaw.com/signup" className="rounded bg-[#22C55E]/80 px-4 py-1.5 text-xs font-medium text-white hover:bg-[#22C55E]">
          Start Free →
        </a>
      </div>
    </footer>
  );
}
