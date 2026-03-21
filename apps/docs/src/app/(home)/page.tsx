import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center text-center px-4 py-16">
      <h1 className="text-4xl font-bold mb-4">SidClaw</h1>
      <p className="text-fd-muted-foreground text-lg mb-8 max-w-xl">
        Governance for AI agents. Identity, policy, approval, and audit — in one platform.
      </p>
      <div className="flex gap-4">
        <Link
          href="/docs"
          className="rounded-md bg-fd-primary px-6 py-2.5 text-sm font-medium text-fd-primary-foreground"
        >
          Get Started
        </Link>
        <Link
          href="/docs/quickstart"
          className="rounded-md border border-fd-border px-6 py-2.5 text-sm font-medium"
        >
          Quick Start
        </Link>
      </div>
    </main>
  );
}
