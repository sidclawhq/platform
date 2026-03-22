# Architecture Diagram Redesign

Replace the hand-coded SVG architecture diagram with a React Flow–based interactive diagram using layered, color-coded nodes and animated edges.

## Context

The current architecture page (`apps/dashboard/src/app/dashboard/architecture/page.tsx`) renders a static SVG with straight-line edges and flat boxes. The edge routing is naive (center-to-center angle calculations), producing overlapping lines and a visually poor result. The diagram is a key visual for the governance platform and deserves better treatment.

## Library

**React Flow** (`@xyflow/react` v12.3.0+, required for React 19 compatibility). Mature React library for node-based diagrams. Provides bezier/smoothstep edge routing, pan/zoom, custom node renderers, animated edges, and tooltips. ~45KB gzipped.

Import the **base stylesheet only** (`@xyflow/react/dist/base.css`) — it provides the viewport and edge rendering essentials without default node/edge styles that would clash with the dark theme. All node styling is handled by the custom `ArchitectureNode` component.

Load the diagram component lazily via `next/dynamic` with `ssr: false` since React Flow requires DOM APIs and the architecture page is low-traffic.

## Visual Design

### Layer Zones

Three background group nodes rendered as subtle rectangles with monospace uppercase labels:

| Zone             | Y range   | Label            |
|------------------|-----------|------------------|
| Identity Layer   | top       | `IDENTITY LAYER` |
| Policy Layer     | middle    | `POLICY LAYER`   |
| Execution Layer  | bottom    | `EXECUTION LAYER`|

- Fill: `#18181B`, border: `#27272A`, border-radius: 8px, opacity: 0.5
- Label: monospace, 9px, `#71717A`, uppercase, letter-spacing: 1px

**Implementation:** Layer zones are NOT React Flow group nodes. They are rendered as absolutely positioned `<div>` elements behind the React Flow canvas (or as a custom background layer via React Flow's `<Background>` slot). This avoids the complexity of group node z-ordering, `parentId` references, and relative child positioning. The zones are purely decorative — they do not affect node positioning.

Alternative: render them as regular React Flow nodes with `type: 'group'`, `zIndex: -1`, and `selectable: false`. If this approach is used, child nodes must NOT set `parentId` — they use absolute coordinates and the group nodes are visual-only.

### Node Positions

All positions are absolute coordinates in the React Flow coordinate space. The container is 800×500.

| Node                        | x    | y    | width | height |
|-----------------------------|------|------|-------|--------|
| Human User / Owner          | 50   | 40   | 180   | 44     |
| Enterprise IdP              | 380  | 40   | 160   | 44     |
| Agent                       | 50   | 120  | 180   | 44     |
| Credential Binding Boundary | 380  | 120  | 200   | 44     |
| Policy Enforcement Point    | 50   | 240  | 200   | 44     |
| Policy Decision Point       | 320  | 240  | 180   | 44     |
| Approval Service            | 560  | 240  | 170   | 44     |
| Authorized Integrations     | 50   | 370  | 200   | 44     |
| Trace / Audit Store         | 560  | 370  | 170   | 44     |

Layer zone backgrounds:

| Zone             | x   | y   | width | height |
|------------------|-----|-----|-------|--------|
| Identity Layer   | 20  | 15  | 750   | 170    |
| Policy Layer     | 20  | 205 | 750   | 100    |
| Execution Layer  | 20  | 330 | 750   | 110    |

### Node Colors by Type

| Type        | Fill      | Border    | Border opacity | Text color |
|-------------|-----------|-----------|----------------|------------|
| Neutral     | `#18181B` | `#3F3F46` | 1.0            | `#E4E4E7`  |
| Agent       | `#1E1B4B` | `#6366F1` | 0.4            | `#A5B4FC`  |
| Policy      | `#172554` | `#3B82F6` | 0.4            | `#93C5FD`  |
| Approval    | `#451A03` | `#F59E0B` | 0.4            | `#FCD34D`  |
| Authorized  | `#052E16` | `#22C55E` | 0.4            | `#86EFAC`  |

- All nodes: border-radius 6px, font-size 11px, font-weight 500
- Credential Boundary: neutral colors with dashed border
- Trace / Audit Store: neutral colors, solid border

### Node Assignments

| Node                       | Type       | Layer     |
|----------------------------|------------|-----------|
| Human User / Owner         | neutral    | Identity  |
| Enterprise IdP             | neutral    | Identity  |
| Agent                      | agent      | Identity  |
| Credential Binding Boundary| neutral (dashed) | Identity |
| Policy Enforcement Point   | policy     | Policy    |
| Policy Decision Point      | policy     | Policy    |
| Approval Service           | approval   | Policy    |
| Authorized Integrations    | authorized | Execution |
| Trace / Audit Store        | neutral    | Execution |

### Edges

- **Edge type:** smoothstep (right-angle routing with rounded corners)
- **Default color:** `#3F3F46`
- **Special colors:**
  - PDP → Approval Service: `#F59E0B` at 0.6 opacity
  - PEP → Authorized Integrations: `#22C55E` at 0.6 opacity
- **Dashed edges:** Agent → Credential Boundary, Agent → Trace, PEP → Trace, Approval → Trace
- **Numbered step badges** on key edges using React Flow's `label` property (steps 1–8). Style: `labelBgStyle: { fill: '#0A0A0B', stroke: '#3F3F46', rx: 8 }`, `labelBgPadding: [4, 8]`, `labelStyle: { fill: '#A1A1AA', fontSize: 10, fontWeight: 600 }`. This produces a small dark pill with the step number.
- **Animated edges** on the main happy path: Agent → PEP → PDP → Approval → Integrations (uses React Flow `animated: true`)

### Edge Definitions

| From                     | To                       | Label | Style   | Animated | Color   |
|--------------------------|--------------------------|-------|---------|----------|---------|
| Human User / Owner       | Agent                    | 1     | solid   | no       | default |
| Human User / Owner       | Enterprise IdP           | —     | solid   | no       | default |
| Agent                    | Credential Boundary      | 2     | dashed  | no       | default |
| Agent                    | Policy Enforcement Point | 3     | solid   | yes      | default |
| Policy Enforcement Point | Policy Decision Point    | 4     | solid   | yes      | default |
| Policy Decision Point    | Approval Service         | 5     | solid   | yes      | amber   |
| Approval Service         | Authorized Integrations  | 6     | solid   | yes      | default |
| Policy Enforcement Point | Authorized Integrations  | 7     | solid   | no       | green   |
| Agent                    | Trace / Audit Store      | 8     | dashed  | no       | default |
| Policy Enforcement Point | Trace / Audit Store      | —     | dashed  | no       | default |
| Approval Service         | Trace / Audit Store      | —     | dashed  | no       | default |

## Interactivity

- **Pan:** drag background to pan
- **Zoom:** scroll to zoom (with min/max bounds)
- **Node dragging:** disabled (`nodesDraggable: false`)
- **Selection:** disabled (`nodesConnectable: false`, `elementsSelectable: false`)
- **Node tooltips:** hover a node to see a description of its role. The custom `ArchitectureNode` component handles `onMouseEnter`/`onMouseLeave` and updates shared tooltip state (via a callback prop or context). Tooltip is positioned relative to the node's DOM bounding box.
- **Edge tooltips:** use `onEdgeMouseEnter`/`onEdgeMouseLeave` callbacks on the `<ReactFlow>` component. These provide the mouse event — position the tooltip at `event.clientX`/`event.clientY` (cursor-following). Edge tooltip shows the step number and a brief description of what happens at that step.
- **Animated edges:** the main happy-path edges use React Flow's `animated: true`, which produces a marching-ants dashed-line animation (CSS `stroke-dashoffset`). This is a subtle movement indicator, not a glow or pulse.
- **`fitView`:** enabled on initial render (`fitView` prop) so the diagram auto-scales to its container regardless of viewport size
- **No minimap or controls panel** — keeps the diagram clean and focused

### Tooltip Content

| Node                       | Tooltip                                                                 |
|----------------------------|-------------------------------------------------------------------------|
| Human User / Owner         | The person or team responsible for the agent's actions                   |
| Enterprise IdP             | Identity provider (Okta, Auth0) for authenticating agent owners         |
| Agent                      | AI agent registered as a governed entity with scoped permissions        |
| Credential Binding Boundary| Cryptographic binding between agent identity and its credentials       |
| Policy Enforcement Point   | Intercepts every agent action and enforces policy decisions             |
| Policy Decision Point      | Evaluates actions against policy rules and data classification          |
| Approval Service           | Routes high-risk actions to human reviewers with rich context           |
| Authorized Integrations    | External services the agent is permitted to access after authorization  |
| Trace / Audit Store        | Immutable log of every evaluation, decision, and outcome               |

### Edge Tooltip Content

| Step | From → To                    | Tooltip                                                        |
|------|------------------------------|----------------------------------------------------------------|
| 1    | Human User → Agent           | Owner registers and configures the agent                       |
| 2    | Agent → Credential Boundary  | Agent presents bound credentials for identity verification     |
| 3    | Agent → PEP                  | Agent requests an action; PEP intercepts it                    |
| 4    | PEP → PDP                    | PEP forwards the action context for policy evaluation          |
| 5    | PDP → Approval Service       | Policy requires human approval for this action                 |
| 6    | Approval → Integrations      | Approved action is forwarded to the target integration         |
| 7    | PEP → Integrations           | Policy allows the action; PEP forwards directly                |
| 8    | Agent → Trace Store          | Agent activity is logged to the audit trail                    |

## Component Structure

### New files

- `apps/dashboard/src/components/architecture/ControlArchitectureDiagram.tsx`
  - `"use client"` component
  - Wraps content in `<ReactFlowProvider>` (needed for `useReactFlow()` if tooltip positioning uses viewport transforms)
  - Contains React Flow instance with nodes, edges, custom node type
  - Manages tooltip state (which node/edge is hovered, position)
  - Container must have explicit height: `h-[500px]` (React Flow does not intrinsically size itself)
  - Exports a single `<ControlArchitectureDiagram />` component

- `apps/dashboard/src/components/architecture/ArchitectureNode.tsx`
  - Custom React Flow node component
  - Renders the colored rectangle with label
  - Handles `onMouseEnter`/`onMouseLeave` for tooltip triggers
  - Accepts node data: `{ label, type, description, dashed?: boolean }`
  - When `dashed` is true, renders with `border-style: dashed` (used for Credential Boundary)

- `apps/dashboard/src/components/architecture/ArchitectureTooltip.tsx`
  - Absolutely positioned tooltip component
  - Dark background (`#18181B`), border (`#3F3F46`), small text
  - Shows node/edge description text
  - Positioned relative to the hovered element

### Modified files

- `apps/dashboard/src/app/dashboard/architecture/page.tsx`
  - Remove all inline SVG code (nodes array, flows array, SVG element)
  - Import diagram via `next/dynamic` with `ssr: false`: `const ControlArchitectureDiagram = dynamic(() => import(...), { ssr: false })`
  - Page remains a Server Component (no `"use client"` needed — dynamic import handles the boundary)
  - Keep the notes grid below unchanged

### New dependency

- `@xyflow/react` — added to `apps/dashboard/package.json`

## What Stays the Same

- The 4 notes cards below the diagram (Identity, Policy, Approval, Auditability)
- The page title and subtitle
- The overall page layout and container styling
