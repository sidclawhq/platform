interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
  compact?: boolean;
}

const PROMPTS = [
  { label: 'Look up my account', prompt: 'Can you look up account A-1234?', effect: 'Allowed instantly', icon: 'allow' },
  { label: 'What\'s the refund policy?', prompt: 'What is the refund policy?', effect: 'Knowledge base search — allowed', icon: 'allow' },
  { label: 'Send a follow-up email', prompt: 'Send a follow-up email to Sarah Johnson about her disputed transaction', effect: 'Requires YOUR approval', icon: 'approval' },
  { label: 'Update case notes', prompt: 'Update case C-5678 with notes: merchant confirmed the charge is valid', effect: 'Requires approval', icon: 'approval' },
  { label: 'Export customer data', prompt: 'Export all customer data to a CSV file', effect: 'Blocked by policy', icon: 'deny' },
  { label: 'Close an account', prompt: 'Close account A-1234', effect: 'Blocked — too high risk', icon: 'deny' },
];

const ICON_COLORS: Record<string, string> = {
  allow: 'text-[#22C55E]',
  approval: 'text-[#F59E0B]',
  deny: 'text-[#EF4444]',
};

const ICON_SYMBOLS: Record<string, string> = {
  allow: '\u2713',
  approval: '\u29D7',
  deny: '\u2717',
};

export function SuggestedPrompts({ onSelect, compact }: SuggestedPromptsProps) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <button
            key={p.prompt}
            onClick={() => onSelect(p.prompt)}
            className="rounded-full border border-[#2A2A2E] bg-[#111113] px-3 py-1 text-sm text-[#A1A1AA] hover:border-[#3B82F6]/50 hover:text-[#E4E4E7] transition-colors"
          >
            <span className={ICON_COLORS[p.icon]}>{ICON_SYMBOLS[p.icon]}</span>{' '}
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium uppercase tracking-wider text-[#71717A]">Try these scenarios</p>
      {PROMPTS.map((p) => (
        <button
          key={p.prompt}
          onClick={() => onSelect(p.prompt)}
          className="w-full rounded-lg border border-[#2A2A2E] bg-[#111113] px-4 py-3 text-left transition-colors hover:border-[#3B82F6]/50"
        >
          <div className="text-base text-[#E4E4E7]">
            <span className={ICON_COLORS[p.icon]}>{ICON_SYMBOLS[p.icon]}</span>{' '}
            {p.label}
          </div>
          <div className="mt-0.5 text-sm text-[#71717A]">{p.effect}</div>
        </button>
      ))}
    </div>
  );
}
