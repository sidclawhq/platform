"use client";

export type TooltipState = {
  text: string;
  x: number;
  y: number;
} | null;

interface ArchitectureTooltipProps {
  tooltip: TooltipState;
}

export default function ArchitectureTooltip({
  tooltip,
}: ArchitectureTooltipProps) {
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
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      {tooltip.text}
    </div>
  );
}
