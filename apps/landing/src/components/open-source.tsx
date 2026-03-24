export function OpenSource() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Deploy anywhere
        </h2>
        <p className="mt-6 text-text-secondary leading-relaxed">
          The SDK is Apache 2.0 — use it anywhere, no restrictions. The
          platform is source-available under the Functional Source License
          (FSL) — inspect every line, audit it yourself. After two years,
          all code converts to Apache 2.0.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 text-left">
          <div className="rounded-lg border border-border-default bg-surface-1 p-6">
            <h3 className="text-sm font-semibold text-text-primary">
              Hosted cloud
            </h3>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              We run it, you use it. Start free, scale as you grow. Zero
              infrastructure to manage.
            </p>
            <a
              href="https://app.sidclaw.com/signup"
              className="mt-4 inline-block text-sm font-medium text-accent-blue hover:underline"
            >
              Start free
            </a>
          </div>
          <div className="rounded-lg border border-accent-amber/30 bg-surface-1 p-6">
            <h3 className="text-sm font-semibold text-text-primary">
              Self-hosted
            </h3>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              Deploy in your own VPC, on-premises, or air-gapped environment.
              One-click deploy to Railway, or use Docker Compose.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <a
                href="https://railway.com/deploy/CtTGrr"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="https://railway.com/button.svg"
                  alt="Deploy on Railway"
                  className="h-8"
                />
              </a>
              <div className="rounded bg-surface-0 px-3 py-2">
                <code className="text-xs font-mono text-text-muted break-all">
                  curl -sSL https://raw.githubusercontent.com/sidclawhq/platform/main/deploy/self-host/setup.sh | bash
                </code>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-sm text-accent-amber">
          Your governance data never leaves your infrastructure unless you
          choose our cloud.
        </p>

        <p className="mt-4 text-sm text-text-muted">
          The governance SDK will always be free and open. We offer hosted
          convenience for teams that want it, and enterprise licenses with
          support for organizations that self-host.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4">
          <a
            href="https://github.com/sidclawhq/platform"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg border border-border-default px-8 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            View on GitHub
          </a>
          <a
            href="https://docs.sidclaw.com/docs/enterprise/self-hosting"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg border border-border-default px-8 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            Self-hosting guide
          </a>
          <a
            href="https://fsl.software"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg border border-border-default px-8 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            Read the FSL License
          </a>
        </div>
      </div>
    </section>
  );
}
