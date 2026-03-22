import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: { role: string; content: string };
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  const hasBlocked = message.content.includes('[BLOCKED BY POLICY]');
  const hasApproval = message.content.includes('[APPROVAL REQUIRED]');

  const cleanedContent = message.content
    .replace('[BLOCKED BY POLICY] ', '')
    .replace('[APPROVAL REQUIRED] ', '');

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
          isUser
            ? 'bg-[#3B82F6] text-white'
            : hasBlocked
            ? 'bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#E4E4E7]'
            : hasApproval
            ? 'bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#E4E4E7]'
            : 'bg-[#111113] border border-[#2A2A2E] text-[#E4E4E7]'
        }`}
      >
        {hasBlocked && (
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-[#EF4444]/20 px-2 py-0.5 text-xs font-medium text-[#EF4444]">
              BLOCKED BY POLICY
            </span>
          </div>
        )}
        {hasApproval && (
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-[#F59E0B]/20 px-2 py-0.5 text-xs font-medium text-[#F59E0B]">
              APPROVAL REQUIRED
            </span>
            <span className="text-xs text-[#71717A]">Check the panel on the right →</span>
          </div>
        )}
        {isUser ? (
          <div className="whitespace-pre-wrap">{cleanedContent}</div>
        ) : (
          <div className="prose-demo">
            <ReactMarkdown>{cleanedContent}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
