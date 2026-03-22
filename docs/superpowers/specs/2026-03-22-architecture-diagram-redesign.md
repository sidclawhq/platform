# Architecture Diagram Redesign

Replace the hand-coded SVG architecture diagram with a React Flow–based interactive diagram using layered, color-coded nodes and animated edges.

## Context

The current architecture page (`apps/dashboard/src/app/dashboard/architecture/page.tsx`) renders a static SVG with straight-line edges and flat boxes. The edge routing is naive (center-to-center angle calculations), producing overlapping lines and a visually poor result. The diagram is a key visual for the governance platform and deserves better treatment.

## Library

**React Flow** (`@xyflow/react` v12). Mature React library for node-based diagrams. Provides bezier/smoothstep edge routing, pan/zoom, custom node renderers, animated edges, and tooltips. ~45KB gzipped.

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
- **Numbered step badges** on key edges using edge labels (steps 1–8)
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
- **Tooltips:** hover a node to see a description of its role; hover an edge to see the step description. Implemented as a custom tooltip component using React state, positioned near the hovered element.
- **Animated edges:** the main happy-path edges pulse with React Flow's built-in CSS animation
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

## Component Structure

### New files

- `apps/dashboard/src/components/architecture/ControlArchitectureDiagram.tsx`
  - `"use client"` component
  - Contains React Flow instance with nodes, edges, custom node type
  - Manages tooltip state (which node/edge is hovered, position)
  - Exports a single `<ControlArchitectureDiagram />` component

- `apps/dashboard/src/components/architecture/ArchitectureNode.tsx`
  - Custom React Flow node component
  - Renders the colored rectangle with label
  - Handles `onMouseEnter`/`onMouseLeave` for tooltip triggers
  - Accepts node data: `{ label, type, description }`

- `apps/dashboard/src/components/architecture/ArchitectureTooltip.tsx`
  - Absolutely positioned tooltip component
  - Dark background (`#18181B`), border (`#3F3F46`), small text
  - Shows node/edge description text
  - Positioned relative to the hovered element

### Modified files

- `apps/dashboard/src/app/dashboard/architecture/page.tsx`
  - Remove all inline SVG code (nodes array, flows array, SVG element)
  - Import and render `<ControlArchitectureDiagram />`
  - Keep the notes grid below unchanged

### New dependency

- `@xyflow/react` — added to `apps/dashboard/package.json`

## What Stays the Same

- The 4 notes cards below the diagram (Identity, Policy, Approval, Auditability)
- The page title and subtitle
- The overall page layout and container styling
