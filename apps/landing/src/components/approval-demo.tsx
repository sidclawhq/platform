'use client';

import { useState } from 'react';

const demos = [
  {
    key: 'finance',
    label: 'Financial Services',
    gif: '/demos/atlas_demo.gif',
    mp4: '/demos/atlas_demo.mp4',
    description: 'AI sends customer email → policy flags it → reviewer approves with context → trace recorded',
    liveUrl: 'https://demo.sidclaw.com',
    color: 'border-accent-amber/50',
  },
  {
    key: 'devops',
    label: 'DevOps',
    gif: '/demos/devops_demo.gif',
    mp4: '/demos/devops_demo.mp4',
    description: 'AI scales production → high-risk deployment flagged → engineer approves → deployed',
    liveUrl: 'https://demo-devops.sidclaw.com',
    color: 'border-accent-blue/50',
  },
  {
    key: 'health',
    label: 'Healthcare',
    gif: '/demos/health_demo.gif',
    mp4: '/demos/health_demo.mp4',
    description: 'AI orders labs → physician reviews clinical context → approves → medication blocked by policy',
    liveUrl: 'https://demo-health.sidclaw.com',
    color: 'border-accent-green/50',
  },
];

export function ApprovalDemo() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = demos[activeIdx]!;

  return (
    <section id="demo" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold text-text-primary text-center mb-3">
          See exactly what your agent wants to do — and decide
        </h2>
        <p className="text-center text-text-secondary mb-8 max-w-2xl mx-auto">
          Every high-risk action surfaces a context-rich approval card. One click to approve or deny.
        </p>

        {/* Tab selector */}
        <div className="flex justify-center gap-2 mb-6">
          {demos.map((demo, idx) => (
            <button
              key={demo.key}
              onClick={() => setActiveIdx(idx)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeIdx === idx
                  ? 'bg-accent-blue text-white'
                  : 'bg-surface-1 text-text-secondary border border-border-default hover:text-text-primary'
              }`}
            >
              {demo.label}
            </button>
          ))}
        </div>

        {/* Video display with GIF fallback */}
        <div className={`rounded-xl border ${active.color} bg-surface-1 p-2 shadow-2xl max-w-5xl mx-auto`}>
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

        <p className="mt-4 text-center text-sm text-text-muted max-w-2xl mx-auto">
          {active.description}
        </p>

        <div className="mt-6 text-center">
          <a
            href={active.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Try This Demo Live →
          </a>
        </div>
      </div>
    </section>
  );
}
