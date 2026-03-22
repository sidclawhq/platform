export function DemoFooter() {
  return (
    <footer className="border-t border-[#2A2A2E] px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-[#71717A]">
          This demo uses <span className="text-[#A1A1AA]">real SidClaw governance</span> — policy evaluation, approvals, and traces are authentic.
          Patient data is simulated — no real PHI is stored or transmitted.
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#71717A]">Ready to govern your agents?</span>
          <a href="https://app.sidclaw.com/signup" className="rounded bg-[#22C55E]/80 px-4 py-1.5 text-xs font-medium text-white hover:bg-[#22C55E]">
            Start Free →
          </a>
        </div>
      </div>
      <div className="mt-1 text-[10px] text-[#52525B]">
        MedAssist Health — Demo Environment &bull; For demonstration purposes only. Not for clinical use.
      </div>
    </footer>
  );
}
