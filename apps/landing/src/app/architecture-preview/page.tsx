"use client";

import dynamic from "next/dynamic";

const Diagram = dynamic(() => import("./diagram"), { ssr: false });

export default function ArchitecturePreviewPage() {
  return <Diagram />;
}
