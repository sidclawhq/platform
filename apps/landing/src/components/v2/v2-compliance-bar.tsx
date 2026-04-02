/* eslint-disable @next/next/no-img-element */

const FLAGS = [
  { src: "https://cdn.countryflags.com/thumbs/united-states-of-america/flag-square-500.png", alt: "United States" },
  { src: "https://cdn.countryflags.com/thumbs/europe/flag-square-500.png", alt: "European Union" },
  { src: "https://cdn.countryflags.com/thumbs/switzerland/flag-square-500.png", alt: "Switzerland" },
  { src: "https://cdn.countryflags.com/thumbs/singapore/flag-square-500.png", alt: "Singapore" },
];

/**
 * Option 6: Gradient announcement bar at the very top of the page.
 */
export function V2ComplianceTopBar() {
  return (
    <div
      className="flex items-center justify-center gap-3 border-b px-6 py-2.5"
      style={{
        background: "linear-gradient(90deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.03) 50%, rgba(59,130,246,0.08) 100%)",
        borderColor: "rgba(59,130,246,0.15)",
      }}
    >
      <div className="flex gap-1">
        {FLAGS.map((f) => (
          <img
            key={f.alt}
            src={f.src}
            alt={`${f.alt} flag`}
            width={20}
            height={20}
            className="h-5 w-5 rounded-full object-cover"
          />
        ))}
      </div>
      <span className="text-[12px] text-text-secondary">
        Compliance-ready for FINRA, EU AI Act, FINMA, and MAS
      </span>
      <a
        href="https://docs.sidclaw.com/docs/compliance/finra-2026"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[12px] text-accent-blue hover:underline"
      >
        Learn more →
      </a>
    </div>
  );
}

const US_FLAG = "https://cdn.countryflags.com/thumbs/united-states-of-america/flag-square-500.png";
const EU_FLAG = "https://cdn.countryflags.com/thumbs/europe/flag-square-500.png";
const CH_FLAG = "https://cdn.countryflags.com/thumbs/switzerland/flag-square-500.png";
const SG_FLAG = "https://cdn.countryflags.com/thumbs/singapore/flag-square-500.png";
const GLOBE = "https://marketplace.canva.com/xWpBY/MAG9hGxWpBY/1/tl/canva-internet-line-globe-icon-MAG9hGxWpBY.png";

const STANDARDS = [
  { flag: US_FLAG, alt: "United States", name: "FINRA" },
  { flag: EU_FLAG, alt: "European Union", name: "EU AI Act" },
  { flag: CH_FLAG, alt: "Switzerland", name: "FINMA" },
  { flag: SG_FLAG, alt: "Singapore", name: "MAS" },
  { flag: US_FLAG, alt: "United States", name: "NIST" },
  { flag: GLOBE, alt: "Global", name: "OWASP", isGlobe: true },
];

/**
 * Option 2: Trust bar with flag+name pairs, placed directly below the hero.
 */
export function V2ComplianceTrustBar() {
  return (
    <div className="border-y border-border-muted bg-surface-0 px-6 py-5">
      {/* Desktop: horizontal with dots */}
      <div className="hidden md:flex items-center justify-center gap-4">
        {STANDARDS.map((s, i) => (
          <div key={s.name} className="contents">
            {i > 0 && <span className="text-[10px] text-border-muted">·</span>}
            <div className="flex items-center gap-2.5">
              <img
                src={s.flag}
                alt={`${s.alt} flag`}
                width={32}
                height={32}
                className={`h-8 w-8 rounded-full object-cover ${s.isGlobe ? "invert-[0.55] brightness-110" : ""}`}
              />
              <span className="text-[13px] font-medium text-text-secondary">{s.name}</span>
            </div>
          </div>
        ))}
      </div>
      {/* Mobile: grid with flag on top, name below */}
      <div className="grid grid-cols-3 gap-4 md:hidden">
        {STANDARDS.map((s) => (
          <div key={s.name} className="flex flex-col items-center gap-1.5">
            <img
              src={s.flag}
              alt={`${s.alt} flag`}
              width={36}
              height={36}
              className={`h-9 w-9 rounded-full object-cover ${s.isGlobe ? "invert-[0.55] brightness-110" : ""}`}
            />
            <span className="text-[11px] font-medium text-text-secondary text-center">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
