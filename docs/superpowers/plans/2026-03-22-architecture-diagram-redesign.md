# Architecture Diagram Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-coded SVG architecture diagram with a React Flow interactive diagram using layered color-coded nodes, smoothstep edges, tooltips, and animated happy-path flow.

**Architecture:** A single `"use client"` component (`ControlArchitectureDiagram`) wraps React Flow with custom node rendering (`ArchitectureNode`) and a tooltip overlay (`ArchitectureTooltip`). The page imports it via `next/dynamic` with `ssr: false`. Layer zones are rendered as non-interactive React Flow nodes with `zIndex: -1`.

**Tech Stack:** React Flow (`@xyflow/react` v12.3.0+), Next.js 15, React 19, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-22-architecture-diagram-redesign.md`

---

### Task 1: Install React Flow dependency

**Files:**
- Modify: `apps/dashboard/package.json`

- [ ] **Step 1: Install `@xyflow/react`**

```bash
cd apps/dashboard && npm install @xyflow/react
```

- [ ] **Step 2: Verify installation**

```bash
cd apps/dashboard && node -e "require('@xyflow/react')" && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/package.json package-lock.json
git commit -m "chore: add @xyflow/react dependency for architecture diagram"
```

---

### Task 2: Create ArchitectureNode custom node component

**Files:**
- Create: `apps/dashboard/src/components/architecture/ArchitectureNode.tsx`

This is the custom React Flow node renderer. It receives node data and renders a styled box with the correct color scheme based on node type.

- [ ] **Step 1: Create the component**

```tsx
// apps/dashboard/src/components/architecture/ArchitectureNode.tsx
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

const NODE_STYLES = {
  neutral: {
    background: "#18181B",
    border: "#3F3F46",
    borderOpacity: 1,
    color: "#E4E4E7",
  },
  agent: {
    background: "#1E1B4B",
    border: "#6366F1",
    borderOpacity: 0.4,
    color: "#A5B4FC",
  },
  policy: {
    background: "#172554",
    border: "#3B82F6",
    borderOpacity: 0.4,
    color: "#93C5FD",
  },
  approval: {
    background: "#451A03",
    border: "#F59E0B",
    borderOpacity: 0.4,
    color: "#FCD34D",
  },
  authorized: {
    background: "#052E16",
    border: "#22C55E",
    borderOpacity: 0.4,
    color: "#86EFAC",
  },
} as const;

type NodeType = keyof typeof NODE_STYLES;

export type ArchitectureNodeData = {
  label: string;
  nodeType: NodeType;
  description: string;
  dashed?: boolean;
  width: number;
  height: number;
  onHover: (nodeId: string, rect: DOMRect) => void;
  onLeave: () => void;
};

type ArchitectureNodeType = Node<ArchitectureNodeData, "architecture">;

export function ArchitectureNode({
  id,
  data,
}: NodeProps<ArchitectureNodeType>) {
  const style = NODE_STYLES[data.nodeType];

  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        background: style.background,
        border: `1px ${data.dashed ? "dashed" : "solid"} ${style.border}`,
        borderRadius: 6,
        borderColor: style.border,
        opacity: style.borderOpacity < 1 ? undefined : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 500,
        color: style.color,
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        data.onHover(id, rect);
      }}
      onMouseLeave={() => data.onLeave()}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="source"
        id="right"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="target"
        id="left"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      {data.label}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/dashboard && npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: no errors related to `ArchitectureNode.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/architecture/ArchitectureNode.tsx
git commit -m "feat: add ArchitectureNode custom React Flow node component"
```

---

### Task 3: Create ArchitectureTooltip component

**Files:**
- Create: `apps/dashboard/src/components/architecture/ArchitectureTooltip.tsx`

A simple absolutely positioned tooltip that renders when a node or edge is hovered.

- [ ] **Step 1: Create the component**

```tsx
// apps/dashboard/src/components/architecture/ArchitectureTooltip.tsx

export type TooltipState = {
  text: string;
  x: number;
  y: number;
} | null;

export function ArchitectureTooltip({ tooltip }: { tooltip: TooltipState }) {
  if (!tooltip) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: tooltip.x,
        top: tooltip.y,
        transform: "translate(-50%, -100%) translateY(-8px)",
        background: "#18181B",
        border: "1px solid #3F3F46",
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: 11,
        color: "#A1A1AA",
        maxWidth: 260,
        lineHeight: 1.4,
        pointerEvents: "none",
        zIndex: 50,
        whiteSpace: "nowrap",
      }}
    >
      {tooltip.text}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/dashboard && npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/architecture/ArchitectureTooltip.tsx
git commit -m "feat: add ArchitectureTooltip component"
```

---

### Task 4: Create ControlArchitectureDiagram main component

**Files:**
- Create: `apps/dashboard/src/components/architecture/ControlArchitectureDiagram.tsx`

This is the main component. It defines all nodes (including layer zone background nodes), edges, and wires up React Flow with tooltips.

- [ ] **Step 1: Create the component**

```tsx
// apps/dashboard/src/components/architecture/ControlArchitectureDiagram.tsx
"use client";

import { useCallback, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type EdgeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";

import {
  ArchitectureNode,
  type ArchitectureNodeData,
} from "./ArchitectureNode";
import { ArchitectureTooltip, type TooltipState } from "./ArchitectureTooltip";

// --- Node tooltip descriptions ---
const NODE_DESCRIPTIONS: Record<string, string> = {
  user: "The person or team responsible for the agent's actions",
  idp: "Identity provider (Okta, Auth0) for authenticating agent owners",
  agent: "AI agent registered as a governed entity with scoped permissions",
  cred: "Cryptographic binding between agent identity and its credentials",
  pep: "Intercepts every agent action and enforces policy decisions",
  pdp: "Evaluates actions against policy rules and data classification",
  approval: "Routes high-risk actions to human reviewers with rich context",
  integ:
    "External services the agent is permitted to access after authorization",
  trace: "Immutable log of every evaluation, decision, and outcome",
};

// --- Edge tooltip descriptions ---
const EDGE_DESCRIPTIONS: Record<string, string> = {
  "1": "Owner registers and configures the agent",
  "2": "Agent presents bound credentials for identity verification",
  "3": "Agent requests an action; PEP intercepts it",
  "4": "PEP forwards the action context for policy evaluation",
  "5": "Policy requires human approval for this action",
  "6": "Approved action is forwarded to the target integration",
  "7": "Policy allows the action; PEP forwards directly",
  "8": "Agent activity is logged to the audit trail",
};

// --- Edge label styling ---
const edgeLabelBgStyle = { fill: "#0A0A0B", stroke: "#3F3F46", rx: 8 };
const edgeLabelBgPadding: [number, number] = [4, 8];
const edgeLabelStyle = { fill: "#A1A1AA", fontSize: 10, fontWeight: 600 };

// --- Colors ---
const DEFAULT_EDGE_COLOR = "#3F3F46";
const AMBER_EDGE_COLOR = "#F59E0B";
const GREEN_EDGE_COLOR = "#22C55E";

const nodeTypes = { architecture: ArchitectureNode };

// --- Helper to build a node ---
function makeNode(
  id: string,
  label: string,
  nodeType: ArchitectureNodeData["nodeType"],
  x: number,
  y: number,
  width: number,
  height: number,
  onHover: ArchitectureNodeData["onHover"],
  onLeave: ArchitectureNodeData["onLeave"],
  dashed?: boolean,
): Node<ArchitectureNodeData> {
  return {
    id,
    type: "architecture",
    position: { x, y },
    data: {
      label,
      nodeType,
      description: NODE_DESCRIPTIONS[id] ?? "",
      dashed,
      width,
      height,
      onHover,
      onLeave,
    },
    draggable: false,
    selectable: false,
    connectable: false,
  };
}

// --- Helper to build a layer zone node ---
function makeZone(
  id: string,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Node {
  return {
    id,
    type: "default",
    position: { x, y },
    data: { label },
    style: {
      width,
      height,
      background: "#18181B",
      border: "1px solid #27272A",
      borderRadius: 8,
      opacity: 0.5,
      fontSize: 9,
      fontFamily: "monospace",
      color: "#71717A",
      textTransform: "uppercase" as const,
      letterSpacing: "1px",
      padding: "8px 12px",
      pointerEvents: "none" as const,
    },
    draggable: false,
    selectable: false,
    connectable: false,
    zIndex: -1,
  };
}

// --- Helper to build an edge ---
function makeEdge(
  id: string,
  source: string,
  target: string,
  label?: string,
  options?: {
    dashed?: boolean;
    animated?: boolean;
    color?: string;
    sourceHandle?: string;
    targetHandle?: string;
  },
): Edge {
  const color = options?.color ?? DEFAULT_EDGE_COLOR;
  return {
    id,
    source,
    target,
    type: "smoothstep",
    sourceHandle: options?.sourceHandle,
    targetHandle: options?.targetHandle,
    label: label && label !== "—" ? label : undefined,
    labelBgStyle: label && label !== "—" ? edgeLabelBgStyle : undefined,
    labelBgPadding:
      label && label !== "—" ? edgeLabelBgPadding : undefined,
    labelStyle: label && label !== "—" ? edgeLabelStyle : undefined,
    animated: options?.animated,
    style: {
      stroke: color,
      strokeDasharray: options?.dashed ? "4 3" : undefined,
      strokeWidth: 1.5,
    },
    markerEnd: {
      type: "arrowclosed" as const,
      color,
      width: 12,
      height: 12,
    },
    data: { step: label },
  };
}

export default function ControlArchitectureDiagram() {
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const onNodeHover = useCallback((nodeId: string, rect: DOMRect) => {
    setTooltip({
      text: NODE_DESCRIPTIONS[nodeId] ?? "",
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  const onNodeLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // --- Layer zones ---
  const zones: Node[] = [
    makeZone("zone-identity", "Identity Layer", 20, 15, 750, 170),
    makeZone("zone-policy", "Policy Layer", 20, 205, 750, 100),
    makeZone("zone-execution", "Execution Layer", 20, 330, 750, 110),
  ];

  // --- Content nodes ---
  const contentNodes: Node<ArchitectureNodeData>[] = [
    makeNode("user", "Human User / Owner", "neutral", 50, 40, 180, 44, onNodeHover, onNodeLeave),
    makeNode("idp", "Enterprise IdP", "neutral", 380, 40, 160, 44, onNodeHover, onNodeLeave),
    makeNode("agent", "Agent", "agent", 50, 120, 180, 44, onNodeHover, onNodeLeave),
    makeNode("cred", "Credential Binding Boundary", "neutral", 380, 120, 200, 44, onNodeHover, onNodeLeave, true),
    makeNode("pep", "Policy Enforcement Point", "policy", 50, 240, 200, 44, onNodeHover, onNodeLeave),
    makeNode("pdp", "Policy Decision Point", "policy", 320, 240, 180, 44, onNodeHover, onNodeLeave),
    makeNode("approval", "Approval Service", "approval", 560, 240, 170, 44, onNodeHover, onNodeLeave),
    makeNode("integ", "Authorized Integrations", "authorized", 50, 370, 200, 44, onNodeHover, onNodeLeave),
    makeNode("trace", "Trace / Audit Store", "neutral", 560, 370, 170, 44, onNodeHover, onNodeLeave),
  ];

  const nodes: Node[] = [...zones, ...contentNodes];

  // --- Edges ---
  const edges: Edge[] = [
    makeEdge("e-user-agent", "user", "agent", "1"),
    makeEdge("e-user-idp", "user", "idp", undefined, { sourceHandle: "right", targetHandle: "left" }),
    makeEdge("e-agent-cred", "agent", "cred", "2", { dashed: true, sourceHandle: "right", targetHandle: "left" }),
    makeEdge("e-agent-pep", "agent", "pep", "3", { animated: true }),
    makeEdge("e-pep-pdp", "pep", "pdp", "4", { animated: true, sourceHandle: "right", targetHandle: "left" }),
    makeEdge("e-pdp-approval", "pdp", "approval", "5", { animated: true, color: AMBER_EDGE_COLOR, sourceHandle: "right", targetHandle: "left" }),
    makeEdge("e-approval-integ", "approval", "integ", "6", { animated: true }),
    makeEdge("e-pep-integ", "pep", "integ", "7", { color: GREEN_EDGE_COLOR }),
    makeEdge("e-agent-trace", "agent", "trace", "8", { dashed: true }),
    makeEdge("e-pep-trace", "pep", "trace", undefined, { dashed: true, sourceHandle: "right" }),
    makeEdge("e-approval-trace", "approval", "trace", undefined, { dashed: true }),
  ];

  const onEdgeMouseEnter: EdgeMouseHandler = useCallback((event, edge) => {
    const step = edge.data?.step as string | undefined;
    if (!step || !EDGE_DESCRIPTIONS[step]) return;
    setTooltip({
      text: `Step ${step}: ${EDGE_DESCRIPTIONS[step]}`,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const onEdgeMouseLeave: EdgeMouseHandler = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <ReactFlowProvider>
      <div className="relative h-[500px] w-full rounded-lg border border-border bg-surface-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.5}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          style={{ background: "transparent" }}
        />
        <ArchitectureTooltip tooltip={tooltip} />
      </div>
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/dashboard && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: no errors. If there are type issues with React Flow generics, adjust the `Node` type parameters.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/architecture/ControlArchitectureDiagram.tsx
git commit -m "feat: add ControlArchitectureDiagram with React Flow, tooltips, animated edges"
```

---

### Task 5: Update the architecture page to use the new diagram

**Files:**
- Modify: `apps/dashboard/src/app/dashboard/architecture/page.tsx`

Replace the entire SVG diagram with a dynamic import of the new component. Keep the notes grid.

- [ ] **Step 1: Rewrite page.tsx**

```tsx
// apps/dashboard/src/app/dashboard/architecture/page.tsx
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
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/dashboard && npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/app/dashboard/architecture/page.tsx
git commit -m "feat: replace SVG architecture diagram with React Flow component"
```

---

### Task 6: Visual verification and polish

**Files:**
- Possibly modify: `apps/dashboard/src/components/architecture/ControlArchitectureDiagram.tsx`

- [ ] **Step 1: Start the dashboard dev server**

```bash
cd apps/dashboard && npm run dev
```

- [ ] **Step 2: Open `http://localhost:3000/dashboard/architecture` in a browser and verify:**

1. Three layer zone backgrounds visible (Identity, Policy, Execution) with monospace labels
2. Nine nodes with correct colors (indigo for Agent, blue for PEP/PDP, amber for Approval, green for Integrations, neutral for others)
3. Credential Binding Boundary has a dashed border
4. Smoothstep edges with right-angle routing (no overlapping straight lines)
5. Numbered step badges (1-8) on edges with dark pill background
6. Happy-path edges (3, 4, 5, 6) have marching-ants animation
7. Amber edge from PDP → Approval, green edge from PEP → Integrations
8. Dashed edges to Trace / Audit Store
9. Pan (drag background) and zoom (scroll) work
10. Hovering a node shows tooltip with description above it
11. Hovering a numbered edge shows tooltip with step description at cursor
12. The 4 notes cards below the diagram are unchanged

- [ ] **Step 3: Adjust node positions or edge routing if needed**

If edges overlap or nodes are misaligned, tweak position coordinates in `ControlArchitectureDiagram.tsx`. Common fixes:
- Adjust `sourceHandle`/`targetHandle` to control which side of a node an edge connects to
- Move nodes horizontally to give edges more routing space

- [ ] **Step 4: Commit any adjustments**

```bash
git add -A
git commit -m "fix: adjust diagram layout after visual verification"
```

- [ ] **Step 5: Run dashboard build to verify production build succeeds**

```bash
cd apps/dashboard && npm run build
```

Expected: build succeeds with no errors.
