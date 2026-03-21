const nodes = [
  { id: "user", label: "Human User / Owner", x: 80, y: 60, w: 170, h: 44 },
  { id: "idp", label: "Enterprise IdP", x: 320, y: 60, w: 140, h: 44 },
  { id: "agent", label: "Agent", x: 80, y: 160, w: 170, h: 44 },
  {
    id: "cred",
    label: "Credential Binding Boundary",
    x: 320,
    y: 160,
    w: 200,
    h: 44,
  },
  {
    id: "pep",
    label: "Policy Enforcement Point",
    x: 80,
    y: 270,
    w: 200,
    h: 44,
  },
  {
    id: "pdp",
    label: "Policy Decision Point",
    x: 340,
    y: 270,
    w: 190,
    h: 44,
  },
  { id: "approval", label: "Approval Service", x: 580, y: 270, w: 160, h: 44 },
  {
    id: "integ",
    label: "Authorized Integrations",
    x: 80,
    y: 380,
    w: 200,
    h: 44,
  },
  {
    id: "trace",
    label: "Trace / Audit Store",
    x: 580,
    y: 380,
    w: 160,
    h: 44,
  },
];

const flows: Array<{
  from: string;
  to: string;
  label: string;
  dashed?: boolean;
}> = [
  { from: "user", to: "agent", label: "1" },
  { from: "user", to: "idp", label: "" },
  { from: "agent", to: "cred", label: "2" },
  { from: "agent", to: "pep", label: "3" },
  { from: "pep", to: "pdp", label: "4" },
  { from: "pdp", to: "approval", label: "5" },
  { from: "approval", to: "integ", label: "6" },
  { from: "pep", to: "integ", label: "7" },
  { from: "agent", to: "trace", label: "8", dashed: true },
  { from: "pep", to: "trace", label: "", dashed: true },
  { from: "approval", to: "trace", label: "", dashed: true },
];

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

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface-1 p-8">
        <svg
          viewBox="0 0 800 460"
          className="mx-auto w-full max-w-[800px]"
          style={{ minWidth: 600 }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" className="fill-border" />
            </marker>
          </defs>

          {flows.map((flow, index) => {
            const from = nodes.find((n) => n.id === flow.from)!;
            const to = nodes.find((n) => n.id === flow.to)!;
            const fromX = from.x + from.w / 2;
            const fromY = from.y + from.h / 2;
            const toX = to.x + to.w / 2;
            const toY = to.y + to.h / 2;
            const angle = Math.atan2(toY - fromY, toX - fromX);
            const startX = fromX + Math.cos(angle) * (from.w / 2.2);
            const startY = fromY + Math.sin(angle) * (from.h / 1.5);
            const endX = toX - Math.cos(angle) * (to.w / 2.2);
            const endY = toY - Math.sin(angle) * (to.h / 1.5);

            return (
              <g key={index}>
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  className="stroke-border"
                  strokeWidth="1"
                  strokeDasharray={flow.dashed ? "4 3" : undefined}
                  markerEnd="url(#arrowhead)"
                />
                {flow.label && (
                  <text
                    x={(startX + endX) / 2 + 6}
                    y={(startY + endY) / 2 - 4}
                    className="fill-text-muted text-[11px]"
                  >
                    {flow.label}
                  </text>
                )}
              </g>
            );
          })}

          {nodes.map((node) => (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={node.w}
                height={node.h}
                rx="4"
                className="fill-surface-0 stroke-border"
                strokeWidth="1"
              />
              <text
                x={node.x + node.w / 2}
                y={node.y + node.h / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground text-[11px] font-medium"
              >
                {node.label}
              </text>
            </g>
          ))}
        </svg>
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
