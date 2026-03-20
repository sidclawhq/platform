import { PageHeader } from "@/components/ui/PageHeader";

/* ------------------------------------------------------------------ */
/*  Box data                                                           */
/* ------------------------------------------------------------------ */

interface ArchBox {
  id: string;
  label: string;
  subtitle?: string;
  col: string;
  row: number;
}

const boxes: ArchBox[] = [
  {
    id: "human",
    label: "Human User / Owner",
    subtitle: "Delegating principal",
    col: "1 / 2",
    row: 1,
  },
  {
    id: "idp",
    label: "Enterprise IdP",
    subtitle: "Identity provider",
    col: "3 / 4",
    row: 1,
  },
  {
    id: "agent",
    label: "Agent",
    subtitle: "Delegated actor",
    col: "1 / 2",
    row: 3,
  },
  {
    id: "cred",
    label: "Credential Binding Boundary",
    subtitle: "Scoped credentials",
    col: "3 / 4",
    row: 3,
  },
  {
    id: "pep",
    label: "Policy Enforcement Point",
    subtitle: "PEP",
    col: "2 / 3",
    row: 5,
  },
  {
    id: "pdp",
    label: "Policy Decision Point",
    subtitle: "PDP",
    col: "1 / 2",
    row: 7,
  },
  {
    id: "approval",
    label: "Approval Service",
    subtitle: "Human-in-the-loop",
    col: "3 / 4",
    row: 7,
  },
  {
    id: "integrations",
    label: "Authorized Integrations",
    subtitle: "External systems",
    col: "1 / 2",
    row: 9,
  },
  {
    id: "audit",
    label: "Trace / Audit Store",
    subtitle: "Correlated records",
    col: "3 / 4",
    row: 9,
  },
];

/* ------------------------------------------------------------------ */
/*  Note data                                                          */
/* ------------------------------------------------------------------ */

const notes = [
  {
    title: "Identity and delegation",
    body: "In production, agent identities may map to service principals or equivalent machine identities. Human approvers authenticate through the enterprise identity provider.",
  },
  {
    title: "Policy evaluation",
    body: "The prototype simulates policy effects locally. A production deployment would typically externalize policy evaluation to a dedicated decision point.",
  },
  {
    title: "Approval control",
    body: "Approval is distinct from policy evaluation. Policy may require human review before an operation proceeds.",
  },
  {
    title: "Auditability",
    body: "Operations are represented as correlated traces rather than isolated log lines.",
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ArchitecturePage() {
  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Architecture"
        subtitle="Conceptual control architecture for governed AI agent operations in enterprise environments."
      />

      {/* ---- Diagram ------------------------------------------------- */}
      <div className="flex justify-center mt-4 mb-16">
        <div className="relative w-full max-w-[800px]">
          {/* SVG connectors — absolutely positioned behind the grid */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="10"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
                fill="rgba(255,255,255,0.15)"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>

            {/* Human -> Agent  (left column, row 1 -> row 3) */}
            <line
              x1="25%"  y1="11.5%"
              x2="25%"  y2="29%"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
            />

            {/* IdP -> Credential Binding  (right column, row 1 -> row 3) */}
            <line
              x1="75%"  y1="11.5%"
              x2="75%"  y2="29%"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
            />

            {/* Agent -> PEP  (left col -> center, row 3 -> row 5) */}
            <line
              x1="25%"  y1="35.5%"
              x2="50%"  y2="48.5%"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
            />

            {/* Credential Binding -> PEP  (right col -> center, row 3 -> row 5) */}
            <line
              x1="75%"  y1="35.5%"
              x2="50%"  y2="48.5%"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
            />

            {/* PEP -> PDP  (center -> left col, row 5 -> row 7) */}
            <line
              x1="50%"  y1="55%"
              x2="25%"  y2="68%"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
            />

            {/* PEP -> Approval Service  (center -> right col, row 5 -> row 7) */}
            <line
              x1="50%"  y1="55%"
              x2="75%"  y2="68%"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
            />

            {/* PDP -> Authorized Integrations  (left col, row 7 -> row 9) */}
            <line
              x1="25%"  y1="74.5%"
              x2="25%"  y2="87%"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
            />

            {/* Approval Service -> Authorized Integrations (right -> left, row 7 -> row 9) */}
            <line
              x1="75%"  y1="74.5%"
              x2="25%"  y2="87%"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
            />

            {/* PEP -> Audit (side connection, dashed) */}
            <line
              x1="62%"  y1="52%"
              x2="75%"  y2="87%"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              strokeDasharray="4 4"
              markerEnd="url(#arrow)"
            />

            {/* Integrations -> Audit (bottom row connection, dashed) */}
            <line
              x1="38%"  y1="91%"
              x2="62%"  y2="91%"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              strokeDasharray="4 4"
              markerEnd="url(#arrow)"
            />
          </svg>

          {/* Grid of boxes */}
          <div
            className="relative grid gap-y-5 gap-x-6"
            style={{
              gridTemplateColumns: "1fr 1fr 1fr",
              gridTemplateRows:
                "auto 28px auto 28px auto 28px auto 28px auto",
            }}
          >
            {boxes.map((box) => (
              <div
                key={box.id}
                className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-5 py-4 flex flex-col items-center justify-center text-center z-10"
                style={{
                  gridColumn: box.col,
                  gridRow: box.row,
                }}
              >
                <span className="text-sm font-medium text-white/70">
                  {box.label}
                </span>
                {box.subtitle && (
                  <span className="text-xs text-white/30 mt-0.5">
                    {box.subtitle}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Notes --------------------------------------------------- */}
      <div className="max-w-[800px] mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        {notes.map((note) => (
          <div
            key={note.title}
            className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-5"
          >
            <h3 className="text-sm font-medium text-white/60 mb-2">
              {note.title}
            </h3>
            <p className="text-sm text-white/40 leading-relaxed">
              {note.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
