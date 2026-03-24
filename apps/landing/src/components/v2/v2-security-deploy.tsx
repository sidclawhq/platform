import { Globe, Lock, Shield, ArrowRight } from "lucide-react";

export function V2SecurityDeploy() {
  return (
    <section className="px-6 py-16 md:py-24 bg-surface-0">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center mb-14">
          <div className="text-[14px] font-medium text-accent-green tracking-[-0.01em] mb-3">Security & Deployment</div>
          <h2 className="text-[32px] sm:text-[40px] md:text-[48px] font-medium tracking-[-0.035em] leading-[1.1] text-white">
            Your infrastructure,
            <br className="hidden sm:block" />
            your control
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Hosted cloud */}
          <div className="rounded-xl border border-border-muted bg-surface-1 p-6">
            <Globe className="h-6 w-6 text-accent-blue mb-4" />
            <h3 className="text-[16px] font-medium text-white mb-2">Hosted Cloud</h3>
            <p className="text-[14px] leading-[1.6] text-text-secondary mb-4">
              We run it, you use it. Start free, scale as you grow. Zero infrastructure to manage.
            </p>
            <a
              href="https://app.sidclaw.com/signup"
              className="inline-flex items-center gap-2 text-[13px] font-medium text-accent-blue hover:text-[#60A5FA]"
            >
              Start free <ArrowRight className="h-3 w-3" />
            </a>
          </div>

          {/* Self-host */}
          <div className="rounded-xl border border-[#F59E0B]/20 bg-surface-1 p-6">
            <Lock className="h-6 w-6 text-accent-amber mb-4" />
            <h3 className="text-[16px] font-medium text-white mb-2">Self-Hosted</h3>
            <p className="text-[14px] leading-[1.6] text-text-secondary mb-4">
              Deploy in your VPC, on-premises, or air-gapped. One-click deploy to Railway, or use Docker Compose.
            </p>
            <div className="rounded-lg border border-border-muted bg-[#0A0B0E] px-3 py-2 mb-3">
              <code className="text-[11px] font-mono text-text-muted break-all">
                curl -sSL https://raw.githubusercontent.com/sidclawhq/platform/main/deploy/self-host/setup.sh | bash
              </code>
            </div>
            <a
              href="https://docs.sidclaw.com/docs/enterprise/self-hosting"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[13px] font-medium text-accent-blue hover:text-[#60A5FA]"
            >
              Self-hosting guide <ArrowRight className="h-3 w-3" />
            </a>
          </div>

          {/* Open source */}
          <div className="rounded-xl border border-border-muted bg-surface-1 p-6">
            <Shield className="h-6 w-6 text-accent-green mb-4" />
            <h3 className="text-[16px] font-medium text-white mb-2">Source Available</h3>
            <p className="text-[14px] leading-[1.6] text-text-secondary mb-4">
              SDK is Apache 2.0. Platform is FSL 1.1 — inspect every line, audit it yourself. Converts to Apache 2.0 in
              2028.
            </p>
            <a
              href="https://github.com/sidclawhq/platform"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[13px] font-medium text-accent-blue hover:text-[#60A5FA]"
            >
              View on GitHub <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
