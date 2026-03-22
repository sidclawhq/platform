interface ChatInputProps {
  input: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export function ChatInput({ input, onChange, onSubmit, isLoading }: ChatInputProps) {
  return (
    <form onSubmit={onSubmit} className="border-t border-[#2A2A2E] px-6 py-4">
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={onChange}
          placeholder="Ask the Atlas Financial support agent..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-[#2A2A2E] bg-[#111113] px-4 py-2.5 text-base text-[#E4E4E7] placeholder-[#71717A] focus:border-[#3B82F6] focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-lg bg-[#3B82F6] px-6 py-2.5 text-base font-medium text-white hover:bg-[#3B82F6]/90 disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </div>
    </form>
  );
}
