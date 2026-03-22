"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";

import ArchitectureNode, {
  type ArchitectureNodeData,
} from "./ArchitectureNode";
import ArchitectureTooltip, { type TooltipState } from "./ArchitectureTooltip";

/* ------------------------------------------------------------------ */
/*  Node type registry                                                */
/* ------------------------------------------------------------------ */

const nodeTypes = { architecture: ArchitectureNode };

/* ------------------------------------------------------------------ */
/*  Tooltip descriptions                                              */
/* ------------------------------------------------------------------ */

const NODE_DESCRIPTIONS: Record<string, string> = {
  user: "The person or team responsible for the agent\u2019s actions",
  idp: "Identity provider (Okta, Auth0) for authenticating agent owners",
  agent: "AI agent registered as a governed entity with scoped permissions",
  cred: "Cryptographic binding between agent identity and its credentials",
  pep: "Intercepts every agent action and enforces policy decisions",
  pdp: "Evaluates actions against policy rules and data classification",
  approval:
    "Routes high-risk actions to human reviewers with rich context",
  integ:
    "External services the agent is permitted to access after authorization",
  trace: "Immutable log of every evaluation, decision, and outcome",
};

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

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const DEFAULT_EDGE_COLOR = "#3F3F46";
const AMBER = "#F59E0B";
const GREEN = "#22C55E";

const LABEL_BG_STYLE = { fill: "#0A0A0B", stroke: "#3F3F46", rx: 8 };
const LABEL_BG_PADDING: [number, number] = [4, 8];
const LABEL_STYLE = { fill: "#A1A1AA", fontSize: 10, fontWeight: 600 };

/* ------------------------------------------------------------------ */
/*  Inner component (must be child of ReactFlowProvider)              */
/* ------------------------------------------------------------------ */

function Diagram() {
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const handleNodeHover = useCallback(
    (nodeId: string, rect: DOMRect) => {
      const desc = NODE_DESCRIPTIONS[nodeId];
      if (desc) {
        setTooltip({
          text: desc,
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      }
    },
    [],
  );

  const handleNodeLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Nodes                                                           */
  /* ---------------------------------------------------------------- */

  const nodes = useMemo<Node[]>(() => {
    /* Layer zone nodes */
    const zoneStyle = {
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
    };

    const zones: Node[] = [
      {
        id: "zone-identity",
        type: "default",
        position: { x: 20, y: 15 },
        data: { label: "IDENTITY LAYER" },
        style: { ...zoneStyle, width: 750, height: 170 },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: -1,
      },
      {
        id: "zone-policy",
        type: "default",
        position: { x: 20, y: 205 },
        data: { label: "POLICY LAYER" },
        style: { ...zoneStyle, width: 750, height: 100 },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: -1,
      },
      {
        id: "zone-execution",
        type: "default",
        position: { x: 20, y: 330 },
        data: { label: "EXECUTION LAYER" },
        style: { ...zoneStyle, width: 750, height: 110 },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: -1,
      },
    ];

    /* Content nodes */
    type ContentNodeDef = {
      id: string;
      label: string;
      nodeType: ArchitectureNodeData["nodeType"];
      x: number;
      y: number;
      width: number;
      height: number;
      dashed?: boolean;
    };

    const contentDefs: ContentNodeDef[] = [
      {
        id: "user",
        label: "Human User / Owner",
        nodeType: "neutral",
        x: 50,
        y: 40,
        width: 180,
        height: 44,
      },
      {
        id: "idp",
        label: "Enterprise IdP",
        nodeType: "neutral",
        x: 380,
        y: 40,
        width: 160,
        height: 44,
      },
      {
        id: "agent",
        label: "Agent",
        nodeType: "agent",
        x: 50,
        y: 120,
        width: 180,
        height: 44,
      },
      {
        id: "cred",
        label: "Credential Binding Boundary",
        nodeType: "neutral",
        x: 380,
        y: 120,
        width: 200,
        height: 44,
        dashed: true,
      },
      {
        id: "pep",
        label: "Policy Enforcement Point",
        nodeType: "policy",
        x: 50,
        y: 240,
        width: 200,
        height: 44,
      },
      {
        id: "pdp",
        label: "Policy Decision Point",
        nodeType: "policy",
        x: 320,
        y: 240,
        width: 180,
        height: 44,
      },
      {
        id: "approval",
        label: "Approval Service",
        nodeType: "approval",
        x: 560,
        y: 240,
        width: 170,
        height: 44,
      },
      {
        id: "integ",
        label: "Authorized Integrations",
        nodeType: "authorized",
        x: 50,
        y: 370,
        width: 200,
        height: 44,
      },
      {
        id: "trace",
        label: "Trace / Audit Store",
        nodeType: "neutral",
        x: 560,
        y: 370,
        width: 170,
        height: 44,
      },
    ];

    const content: Node[] = contentDefs.map((def) => ({
      id: def.id,
      type: "architecture",
      position: { x: def.x, y: def.y },
      data: {
        label: def.label,
        nodeType: def.nodeType,
        description: NODE_DESCRIPTIONS[def.id] ?? "",
        dashed: def.dashed,
        width: def.width,
        height: def.height,
        onHover: handleNodeHover,
        onLeave: handleNodeLeave,
      },
      draggable: false,
      selectable: false,
      connectable: false,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }));

    return [...zones, ...content];
  }, [handleNodeHover, handleNodeLeave]);

  /* ---------------------------------------------------------------- */
  /*  Edges                                                           */
  /* ---------------------------------------------------------------- */

  const edges = useMemo<Edge[]>(() => {
    function mkMarker(color: string) {
      return {
        type: "arrowclosed" as const,
        color,
        width: 12,
        height: 12,
      };
    }

    type EdgeDef = {
      id: string;
      source: string;
      target: string;
      label?: string;
      dashed?: boolean;
      highlighted?: boolean;
      color?: string;
      sourceHandle?: string;
      targetHandle?: string;
    };

    const defs: EdgeDef[] = [
      { id: "e-user-agent", source: "user", target: "agent", label: "1" },
      {
        id: "e-user-idp",
        source: "user",
        target: "idp",
        sourceHandle: "right",
        targetHandle: "left",
      },
      {
        id: "e-agent-cred",
        source: "agent",
        target: "cred",
        label: "2",
        dashed: true,
        sourceHandle: "right",
        targetHandle: "left",
      },
      {
        id: "e-agent-pep",
        source: "agent",
        target: "pep",
        label: "3",
        highlighted: true,
      },
      {
        id: "e-pep-pdp",
        source: "pep",
        target: "pdp",
        label: "4",
        highlighted: true,
        sourceHandle: "right",
        targetHandle: "left",
      },
      {
        id: "e-pdp-approval",
        source: "pdp",
        target: "approval",
        label: "5",
        highlighted: true,
        color: AMBER,
        sourceHandle: "right",
        targetHandle: "left",
      },
      {
        id: "e-approval-integ",
        source: "approval",
        target: "integ",
        label: "6",
        highlighted: true,
      },
      {
        id: "e-pep-integ",
        source: "pep",
        target: "integ",
        label: "7",
        color: GREEN,
      },
      {
        id: "e-agent-trace",
        source: "agent",
        target: "trace",
        label: "8",
        dashed: true,
      },
      {
        id: "e-pep-trace",
        source: "pep",
        target: "trace",
        dashed: true,
        sourceHandle: "right",
      },
      {
        id: "e-approval-trace",
        source: "approval",
        target: "trace",
        dashed: true,
      },
    ];

    return defs.map((def) => {
      const color = def.color ?? DEFAULT_EDGE_COLOR;
      // Happy-path edges get a brighter stroke instead of dashed animation
      const strokeColor = def.highlighted
        ? (def.color ?? "#52525B")
        : color;
      const edge: Edge = {
        id: def.id,
        source: def.source,
        target: def.target,
        type: "smoothstep",
        style: {
          stroke: strokeColor,
          strokeWidth: def.highlighted ? 2 : 1.5,
          strokeDasharray: def.dashed ? "6 3" : undefined,
        },
        markerEnd: mkMarker(strokeColor),
        ...(def.sourceHandle ? { sourceHandle: def.sourceHandle } : {}),
        ...(def.targetHandle ? { targetHandle: def.targetHandle } : {}),
      };

      if (def.label) {
        edge.label = def.label;
        edge.labelBgStyle = LABEL_BG_STYLE;
        edge.labelBgPadding = LABEL_BG_PADDING;
        edge.labelStyle = LABEL_STYLE;
      }

      return edge;
    });
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Edge hover handler                                              */
  /* ---------------------------------------------------------------- */

  const onEdgeMouseEnter = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      const step = edge.label as string | undefined;
      if (step && EDGE_DESCRIPTIONS[step]) {
        setTooltip({
          text: EDGE_DESCRIPTIONS[step],
          x: event.clientX,
          y: event.clientY,
        });
      }
    },
    [],
  );

  const onEdgeMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div className="relative h-[500px] w-full rounded-lg border border-border bg-surface-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
      />
      <ArchitectureTooltip tooltip={tooltip} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported wrapper with provider                                    */
/* ------------------------------------------------------------------ */

export default function ControlArchitectureDiagram() {
  return (
    <ReactFlowProvider>
      <Diagram />
    </ReactFlowProvider>
  );
}
