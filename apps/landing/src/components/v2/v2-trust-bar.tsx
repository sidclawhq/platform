/* eslint-disable @next/next/no-img-element */

const STANDARDS = [
  {
    name: "FINRA 2026",
    geo: "United States",
    flag: "https://cdn.countryflags.com/thumbs/united-states-of-america/flag-square-500.png",
  },
  {
    name: "EU AI Act",
    geo: "European Union",
    flag: "https://cdn.countryflags.com/thumbs/europe/flag-square-500.png",
  },
  {
    name: "FINMA",
    geo: "Switzerland",
    flag: "https://cdn.countryflags.com/thumbs/switzerland/flag-square-500.png",
  },
  {
    name: "MAS TRM",
    geo: "Singapore",
    flag: "https://cdn.countryflags.com/thumbs/singapore/flag-square-500.png",
  },
  {
    name: "NIST AI RMF",
    geo: "United States",
    flag: "https://cdn.countryflags.com/thumbs/united-states-of-america/flag-square-500.png",
  },
  {
    name: "OWASP Agentic",
    geo: "Global",
    flag: "https://marketplace.canva.com/xWpBY/MAG9hGxWpBY/1/tl/canva-internet-line-globe-icon-MAG9hGxWpBY.png",
    isGlobe: true,
  },
];

export function V2TrustBar() {
  return (
    <section className="px-6 py-16 md:py-20">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted mb-10">
          Built for compliance frameworks
        </div>
        <div className="flex flex-wrap items-start justify-center gap-12 md:gap-14">
          {STANDARDS.map((s) => (
            <div key={s.name} className="flex flex-col items-center w-[130px]">
              <img
                src={s.flag}
                alt={`${s.geo} flag`}
                width={80}
                height={80}
                className={`h-[80px] w-[80px] rounded-full object-cover ${s.isGlobe ? "invert-[0.7] brightness-125" : ""}`}
              />
              <div className="mt-3.5 text-[14px] font-semibold text-text-primary text-center">
                {s.name}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-text-muted">
                {s.geo}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <a
            href="https://docs.sidclaw.com/docs/compliance/finra-2026"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[14px] text-accent-blue hover:underline"
          >
            View Compliance Documentation →
          </a>
        </div>
      </div>
    </section>
  );
}
