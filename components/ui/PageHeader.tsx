import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="pb-6 mb-6 border-b border-white/[0.06]">
      <h1 className="text-2xl font-semibold text-white/90">{title}</h1>
      <p className="text-sm text-white/50 mt-1">{subtitle}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
