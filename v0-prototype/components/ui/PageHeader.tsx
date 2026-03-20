import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {subtitle}
      </p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
