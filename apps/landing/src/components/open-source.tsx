export function OpenSource() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Open source at the core
        </h2>
        <p className="mt-6 text-text-secondary leading-relaxed">
          The SDK is Apache 2.0 open source. Inspect every line. Self-host if
          you want. We monetize the hosted platform, not the developer tool.
        </p>
        <a
          href="https://github.com/sidclawhq/sdk"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-block rounded-lg border border-border-default px-8 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          View on GitHub
        </a>
      </div>
    </section>
  );
}
