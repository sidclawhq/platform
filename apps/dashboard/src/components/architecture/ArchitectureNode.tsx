"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

type NodeColorType = "neutral" | "agent" | "policy" | "approval" | "authorized";

const COLOR_MAP: Record<
  NodeColorType,
  { bg: string; border: string; borderOpacity: number; text: string }
> = {
  neutral: { bg: "#18181B", border: "#3F3F46", borderOpacity: 1.0, text: "#E4E4E7" },
  agent: { bg: "#1E1B4B", border: "#6366F1", borderOpacity: 0.4, text: "#A5B4FC" },
  policy: { bg: "#172554", border: "#3B82F6", borderOpacity: 0.4, text: "#93C5FD" },
  approval: {
    bg: "#451A03",
    border: "#F59E0B",
    borderOpacity: 0.4,
    text: "#FCD34D",
  },
  authorized: {
    bg: "#052E16",
    border: "#22C55E",
    borderOpacity: 0.4,
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

  // Convert hex border color + opacity to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const borderColor = hexToRgba(colors.border, colors.borderOpacity);
  const handleStyle = {
    width: 0,
    height: 0,
    minWidth: 0,
    minHeight: 0,
    border: "none",
    background: "transparent",
    opacity: 0,
    pointerEvents: "none" as const,
  };

  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        background: colors.bg,
        border: `1px ${data.dashed ? "dashed" : "solid"} ${borderColor}`,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 500,
        color: colors.text,
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
