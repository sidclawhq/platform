"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

type NodeColorType = "neutral" | "agent" | "policy" | "approval" | "authorized";

const COLOR_MAP: Record<
  NodeColorType,
  { bg: string; border: string; opacity: number; text: string }
> = {
  neutral: { bg: "#18181B", border: "#3F3F46", opacity: 1.0, text: "#E4E4E7" },
  agent: { bg: "#1E1B4B", border: "#6366F1", opacity: 0.4, text: "#A5B4FC" },
  policy: { bg: "#172554", border: "#3B82F6", opacity: 0.4, text: "#93C5FD" },
  approval: {
    bg: "#451A03",
    border: "#F59E0B",
    opacity: 0.4,
    text: "#FCD34D",
  },
  authorized: {
    bg: "#052E16",
    border: "#22C55E",
    opacity: 0.4,
    text: "#86EFAC",
  },
};

export type ArchitectureNodeData = {
  label: string;
  nodeType: NodeColorType;
  description: string;
  dashed?: boolean;
  width: number;
  height: number;
  onHover: (id: string, rect: DOMRect) => void;
  onLeave: () => void;
};

export type ArchitectureNodeType = Node<ArchitectureNodeData, "architecture">;

export default function ArchitectureNode({
  id,
  data,
}: NodeProps<ArchitectureNodeType>) {
  const colors = COLOR_MAP[data.nodeType];

  const handleStyle = { opacity: 0, pointerEvents: "none" as const };

  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        background: colors.bg,
        border: `1px ${data.dashed ? "dashed" : "solid"} ${colors.border}`,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 500,
        color: colors.text,
        opacity: colors.opacity,
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        data.onHover(id, rect);
      }}
      onMouseLeave={() => {
        data.onLeave();
      }}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={handleStyle}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={handleStyle}
      />
      {data.label}
    </div>
  );
}
