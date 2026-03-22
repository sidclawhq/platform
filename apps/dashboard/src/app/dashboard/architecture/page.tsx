"use client";

import dynamic from "next/dynamic";

const ControlArchitectureDiagram = dynamic(
  () => import("@/components/architecture/ControlArchitectureDiagram"),
  { ssr: false },
);

const notes = [
  {
    title: "Identity",
    body: "Every agent is a governed entity with an owner, authority model, and scoped permissions.",
  },
  {
    title: "Policy",
    body: "Policy rules evaluate every action against data classification, operation type, and scope.",
  },
  {
    title: "Approval",
    body: "High-risk actions surface rich context to human reviewers before execution.",
  },
  {
    title: "Auditability",
    body: "Every evaluation, decision, and outcome creates a correlated, chronological trace.",
  },
];

export default function ArchitecturePage() {
  return (
    <div>
      <h1 className="text-lg font-medium text-foreground">
        Control Architecture
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Conceptual control architecture for governed AI agent operations in
        enterprise environments.
      </p>

      <div className="mt-6">
        <ControlArchitectureDiagram />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {notes.map((note) => (
          <div
            key={note.title}
            className="rounded-lg border border-border bg-surface-1 p-5"
          >
            <h3 className="mb-1 text-[13px] font-medium text-foreground">
              {note.title}
            </h3>
            <p className="text-[12px] leading-relaxed text-text-muted">
              {note.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
