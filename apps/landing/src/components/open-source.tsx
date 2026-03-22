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
          </div>
          <div className="rounded-lg border border-accent-amber/30 bg-surface-1 p-6">
            <h3 className="text-sm font-semibold text-text-primary">
              Self-hosted
            </h3>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              Deploy in your own VPC, on-premises, or air-gapped environment.
              Enterprise license includes support, SLA, and compliance
              documentation.
            </p>
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
