'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

export function PendingApprovalBadge() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const result = await api.getApprovalCount('pending');
        setCount(result.count);
      } catch {
        // Silently fail — badge just won't show
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <span data-testid="pending-approval-badge" className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-amber text-[10px] font-semibold text-surface-0">
      {count > 99 ? '99+' : count}
    </span>
  );
}
