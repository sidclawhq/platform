const plans = [
  {
    name: "Free",
    price: "$0/month",
    priceSubtext: null,
    features: [
      "5 agents",
      "10 policies per agent",
      "2 API keys",
      "7-day trace retention",
      "Community support",
    ],
    cta: "Get Started",
    ctaHref: "https://app.sidclaw.com/signup",
    ctaSubtext: "No credit card required",
    highlight: false,
    badge: null,
  },
  {
    name: "Team",
    price: "$499/month",
    priceSubtext: "Custom pricing for larger teams",
    features: [
      "50 agents",
      "Unlimited policies",
      "10 API keys",
      "90-day retention",
      "Email support",
    ],
    cta: "Start Team Trial",
    ctaHref: "mailto:hello@sidclaw.com",
    ctaSubtext: null,
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    price: "Custom",
    priceSubtext: "Self-hosted or cloud",
    features: [
      "Unlimited agents",
      "Unlimited policies",
      "Unlimited API keys",
      "Custom retention",
      "SSO/OIDC",
      "Self-hosted in your VPC",
      "Dedicated support & SLA",
      "Compliance documentation",
    ],
    cta: "Contact Sales",
    ctaHref: "mailto:hello@sidclaw.com",
    ctaSubtext: null,
    highlight: false,
    badge: null,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Pricing
        </h2>
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-lg border bg-surface-1 p-6 ${
                plan.highlight
                  ? "border-accent-blue"
                  : "border-border-default"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent-amber px-3 py-0.5 text-xs font-semibold text-black">
                  {plan.badge}
                </span>
              )}
              <h3 className="text-base font-semibold text-text-primary">
                {plan.name}
              </h3>
              <p className="mt-2 text-2xl font-bold text-text-primary">
                {plan.price}
              </p>
              {plan.priceSubtext && (
                <p className="mt-1 text-xs text-text-muted">
                  {plan.priceSubtext}
                </p>
              )}
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-text-secondary"
                  >
                    <span className="mt-0.5 text-accent-green">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={plan.ctaHref}
                className={`mt-8 block rounded-lg py-2.5 text-center text-sm font-medium transition-opacity hover:opacity-90 ${
                  plan.highlight
                    ? "bg-accent-blue text-white"
                    : "border border-border-default text-text-secondary hover:text-text-primary"
                }`}
              >
                {plan.cta}
              </a>
              {plan.ctaSubtext && (
                <p className="mt-2 text-center text-xs text-text-muted">
                  {plan.ctaSubtext}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
