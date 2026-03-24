"use client";

import { useState, useCallback } from "react";
import { ExternalLink } from "lucide-react";

const DEMO_VIDEOS = [
  {
    key: "finance",
    label: "Financial Services",
    gif: "/demos/atlas_demo.gif",
    mp4: "/demos/atlas_demo.mp4",
    description:
      "AI sends customer email \u2192 policy flags it \u2192 reviewer approves with context \u2192 trace recorded",
    liveUrl: "https://demo.sidclaw.com",
    accentBorder: "border-accent-amber/50",
  },
  {
    key: "devops",
    label: "DevOps",
    gif: "/demos/devops_demo.gif",
    mp4: "/demos/devops_demo.mp4",
    description:
      "AI scales production \u2192 high-risk deployment flagged \u2192 engineer approves \u2192 deployed",
    liveUrl: "https://demo-devops.sidclaw.com",
    accentBorder: "border-accent-blue/50",
  },
  {
    key: "health",
    label: "Healthcare",
    gif: "/demos/health_demo.gif",
    mp4: "/demos/health_demo.mp4",
    description:
      "AI orders labs \u2192 physician reviews clinical context \u2192 approves \u2192 medication blocked by policy",
    liveUrl: "https://demo-health.sidclaw.com",
    accentBorder: "border-accent-green/50",
  },
];

export function V2DemoPlayer() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const active = DEMO_VIDEOS[activeIdx]!;

  const switchDemo = useCallback(
    (idx: number) => {
      if (idx === activeIdx || fading) return;
      setFading(true);
      setTimeout(() => {
        setActiveIdx(idx);
        setFading(false);
      }, 150);
    },
    [activeIdx, fading],
  );

  return (
    <section className="px-6 py-16 md:py-24 bg-surface-0">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center mb-12">
          <div className="text-[14px] font-medium text-accent-blue tracking-[-0.01em] mb-3">
            See It In Action
          </div>
          <h2 className="text-[32px] sm:text-[40px] md:text-[48px] font-medium tracking-[-0.035em] leading-[1.1] text-white">
            Watch governance happen
            <br className="hidden sm:block" />
            in real time
          </h2>
        </div>

        {/* Tab selector */}
        <div className="flex justify-center gap-2 mb-8">
          {DEMO_VIDEOS.map((demo, idx) => (
            <button
              key={demo.key}
              onClick={() => switchDemo(idx)}
              className={`rounded-full px-5 py-2 text-[13px] font-medium transition-colors duration-200 ${
                activeIdx === idx
                  ? "bg-accent-blue text-white"
                  : "border border-border-muted bg-surface-1 text-text-secondary hover:text-white"
              }`}
            >
              {demo.label}
            </button>
          ))}
        </div>

        {/* Video player with crossfade */}
        <div
          className={`rounded-xl border bg-surface-1 p-2 shadow-2xl max-w-[1000px] mx-auto transition-all duration-150 ${active.accentBorder} ${
            fading ? "opacity-0 scale-[0.99]" : "opacity-100 scale-100"
          }`}
        >
          <video
            key={active.mp4}
            autoPlay
            muted
            loop
            playsInline
            className="w-full rounded-lg"
            poster={active.gif}
          >
            <source src={active.mp4} type="video/mp4" />
          </video>
        </div>

        {/* Description + CTA with matching fade */}
        <div
          className={`transition-opacity duration-150 ${fading ? "opacity-0" : "opacity-100"}`}
        >
          <p className="mt-5 text-center text-[14px] text-text-muted max-w-[600px] mx-auto">
            {active.description}
          </p>

          <div className="mt-6 text-center">
            <a
              href={active.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-accent-blue px-6 py-2.5 text-[14px] font-medium text-white hover:bg-[#2563EB] transition-colors"
            >
              Try This Demo Live
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
