export function Footer() {
  return (
    <footer className="border-t border-[#2A2A2E] px-6 py-12">
      <div className="mx-auto max-w-5xl">
        {/* Brand */}
        <div className="mb-8">
          <div className="text-base font-semibold text-[#E4E4E7]">SidClaw</div>
          <div className="mt-1 text-sm text-[#71717A]">The approval layer for agentic AI</div>
        </div>

        {/* 4-column links */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-[#71717A] mb-3">Product</div>
            <div className="space-y-2">
              <a href="https://app.sidclaw.com" target="_blank" rel="noopener noreferrer" className="block text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">Dashboard</a>
              <a href="#pricing" className="block text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">Pricing</a>
              <a href="#demos" className="block text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">Live Demos</a>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-[#71717A] mb-3">Developers</div>
            <div className="space-y-2">
              <a href="https://docs.sidclaw.com" target="_blank" rel="noopener noreferrer" className="block text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">Docs</a>
              <a href="https://www.npmjs.com/package/@sidclaw/sdk" target="_blank" rel="noopener noreferrer" className="block text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">SDK on npm</a>
              <a href="https://docs.sidclaw.com/docs/quickstart" target="_blank" rel="noopener noreferrer" className="block text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">Quick Start</a>
              <a href="https://docs.sidclaw.com/docs/api-reference" target="_blank" rel="noopener noreferrer" className="block text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">API Reference</a>
              <a href="https://github.com/sidclawhq/platform/tree/main/examples" target="_blank" rel="noopener noreferrer" className="block text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">Examples</a>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-[#71717A] mb-3">Compliance</div>
            <div className="space-y-2">
              <a href="https://docs.sidclaw.com/docs/compliance/finra-2026" target="_blank" rel="noopener noreferrer" className="block text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">FINRA 2026</a>
              <a href="https://docs.sidclaw.com/docs/compliance/eu-ai-act" target="_blank" rel="noopener noreferrer" className="block text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">EU AI Act</a>
              <a href="https://docs.sidclaw.com/docs/compliance/finma" target="_blank" rel="noopener noreferrer" className="block text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">FINMA</a>
              <a href="https://docs.sidclaw.com/docs/compliance/nist-ai-rmf" target="_blank" rel="noopener noreferrer" className="block text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">NIST AI RMF</a>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-[#71717A] mb-3">Company</div>
            <div className="space-y-2">
              <a href="https://github.com/sidclawhq/platform" target="_blank" rel="noopener noreferrer" className="block text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">GitHub</a>
              <a href="mailto:hello@sidclaw.com" className="block text-sm text-[#A1A1AA] hover:text-[#E4E4E7]">Contact</a>
            </div>
          </div>
        </div>

        {/* Bottom line */}
        <div className="mt-10 border-t border-[#2A2A2E] pt-6 text-xs text-[#71717A]">
          © 2026 SidClaw. SDK: Apache 2.0. Platform: FSL 1.1.
        </div>
      </div>
    </footer>
  );
}
