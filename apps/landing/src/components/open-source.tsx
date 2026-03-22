export function OpenSource() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Open source at the core
        </h2>
        <p className="mt-6 text-text-secondary leading-relaxed">
          The SDK is Apache 2.0 — use it anywhere, no restrictions. The
          platform is source-available under the Functional Source License
          (FSL) — inspect every line, self-host for internal use. After two
          years, all code converts to Apache 2.0.
        </p>
        <p className="mt-4 text-sm text-text-muted">
          We monetize the hosted platform, not the developer tool. Your
          governance SDK will always be free and open.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <a
            href="https://github.com/sidclawhq/platform"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg border border-border-default px-8 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            View SDK on GitHub
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
