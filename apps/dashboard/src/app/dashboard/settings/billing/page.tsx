export default function BillingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-text-primary">Billing</h1>

      <div className="rounded-lg border border-border-default bg-surface-1 p-6">
        <p className="text-sm text-text-primary font-medium">
          SidClaw is free to use.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          For enterprise needs or questions, contact{' '}
          <a
            href="mailto:hello@sidclaw.com"
            className="text-accent-blue hover:underline"
          >
            hello@sidclaw.com
          </a>
        </p>
      </div>
    </div>
  );
}
