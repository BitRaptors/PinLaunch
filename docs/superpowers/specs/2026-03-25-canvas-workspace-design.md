# Canvas Workspace — Design Spec

**Date:** 2026-03-25
**Status:** Approved

## Overview

PinLaunch evolves from a landing page generator into a full design tool. The `/canvas` route introduces an infinite canvas workspace where users collect references, generate pages via AI, iterate on designs, and export a complete application. The canvas is the central workspace; the sidebar is the interaction surface.

## Node Types

### Artboard (generated pages)
- Fixed viewport sizes: desktop (1440x900), tablet (768x1024), mobile (375x812)
- Rendered via iframe pointing to `/api/preview/` routes
- Header bar: name, viewport badge, exclude-from-export toggle, "Edit" button
- "Edit" button switches the Chat tab to this artboard's context for AI refinement
- Not freely resizable — viewport preset switching only
- Draggable on canvas
- **Pointer event handling:** A transparent overlay div captures drag/pan events by default. When the user clicks "Edit" (or double-clicks the artboard), it enters interactive mode — the overlay is removed and pointer events pass through to the iframe. Clicking outside or pressing Escape exits interactive mode.
- **Virtualization:** Only artboards whose bounding box intersects the current viewport render an iframe. Off-screen artboards render a static thumbnail placeholder (captured on last content change).

### Image
- Drag-and-drop from filesystem or URL
- Freely resizable with optional aspect ratio lock (Shift+drag)
- Uploaded via `POST /api/uploads` (multipart form data), stored in `data/uploads/`
- Canvas state references relative path
- If the referenced file is missing, displays a "missing image" placeholder

### Document
- Rendered markdown by default
- Double-click → inline markdown editor
- Freely movable and resizable
- Semi-transparent surface background

### Shape (wireframe primitives)
- Types: `rectangle`, `circle`, `rounded-rect`, `line`
- Rendered with roughjs **SVG mode** (inline SVG elements in the DOM)
- Central text label on each (DOM element, positioned over the SVG)
- Color and border customizable via inspector
- Freely movable and resizable

### UI Widget (wireframe components)
- Predefined set: `button`, `cta`, `input`, `dropdown`, `navbar`, `card`, `hero`, `footer`, `checkbox`, `toggle`
- Rendered with roughjs **SVG mode** with recognizable form (e.g., button = rounded rect + centered text, dropdown = rect + arrow)
- Editable label
- Freely movable and resizable

## Canvas Architecture

### Layer stack (bottom to top)
1. **Grid layer** — infinite background grid (dot pattern), CSS-based, scales with zoom
2. **Node layer** — all nodes rendered as React DOM elements (SVG for shapes/widgets via roughjs SVG mode, HTML for artboards/images/documents), absolutely positioned in world-space

Using roughjs SVG mode eliminates the need for a separate `<canvas>` element. All nodes live in the same DOM layer, simplifying zoom/pan synchronization.

### Pan/Zoom
- `react-zoom-pan-pinch` wraps the node layer in a `TransformWrapper`
- Grid layer uses CSS background-image that scales with the transform

### Coordinate system
- Every node stores `{x, y, width, height}` in canvas world-space
- Pan/zoom transform handled by library

### Node ordering
- Each node has a `zIndex` field (integer, default 0)
- Higher zIndex renders on top
- Context menu: "Bring to Front" / "Send to Back"
- New nodes get `zIndex = max(existing) + 1`

### State model
```typescript
type NodeType = 'artboard' | 'image' | 'document' | 'shape' | 'widget'

type CanvasNode = {
  id: string
  type: NodeType
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  excludeFromExport?: boolean  // artboards only
  data: ArtboardNodeData | ImageNodeData | DocNodeData | ShapeNodeData | WidgetNodeData
}

type ArtboardNodeData = {
  name: string
  siteDir: string            // e.g., "site-1711270400000"
  viewport: 'desktop' | 'tablet' | 'mobile'
  provider: 'gemini' | 'claude'
  sessionId?: string
  thumbnailUrl?: string      // cached screenshot for off-screen rendering
}

type ImageNodeData = {
  src: string                // relative path in data/uploads/
  alt?: string
}

type DocNodeData = {
  markdown: string
  title?: string
}

type ShapeNodeData = {
  shapeType: 'rectangle' | 'circle' | 'rounded-rect' | 'line'
  label: string
  fillColor?: string
  strokeColor?: string
}

type WidgetNodeData = {
  widgetType: 'button' | 'cta' | 'input' | 'dropdown' | 'navbar' | 'card' | 'hero' | 'footer' | 'checkbox' | 'toggle'
  label: string
  fillColor?: string
  strokeColor?: string
}

type CanvasState = {
  nodes: CanvasNode[]
  viewport: { x: number; y: number; zoom: number }
}
```

### Persistence
- Stored in SQLite `canvas_state` table (JSON column), consistent with the existing data layer
- Schema: `canvas_state (id INTEGER PRIMARY KEY, project_id INTEGER REFERENCES projects(id), state TEXT, updated_at TEXT)`
- One canvas per project (uses existing `projects` table)
- Initial implementation uses a single auto-created default project. Multi-project canvas support will be added later.
- Auto-saved on every change (debounced ~500ms)
- `beforeunload` as best-effort fallback (unreliable on mobile)
- API route: `GET/PUT /api/canvas?projectId=...`

## Canvas Interactions

### Selection
- Click → select node (blue border + resize handles)
- Shift+click → multi-select
- Drag on empty area → lasso selection rectangle
- Escape → deselect

### Move and resize
- Drag selected node → move
- Corner handles → resize (disabled for artboards — viewport preset only)
- Shift+drag on shapes/images → aspect ratio lock

### Navigation
- Scroll / trackpad → pan
- Ctrl+scroll / pinch → zoom (10%–400%)
- Double-click empty area → zoom to fit all nodes
- Minimap in bottom-right corner: shows bounding-box outlines of all nodes, viewport rectangle indicator, click to navigate

### Creating nodes
- Top toolbar: shape tools, widget palette, "Add Image", "Add Document"
- Shape tool selected → drag on canvas → draw shape
- Image: toolbar button or drag-and-drop from filesystem
- New artboards: only created through generation (sidebar Setup/Chat)

### Deleting nodes
- Delete/Backspace on selected nodes
- Right-click → context menu → Delete

### Undo/Redo
- Ctrl+Z / Ctrl+Shift+Z
- In-memory history stack (max ~50 steps)
- Stores full state snapshots (canvas node count is small enough for this approach)

### Empty canvas
- First visit shows centered welcome message: "Start by adding pins and generating your first page in the Setup tab"
- Arrow pointing to the sidebar Setup tab

## Sidebar

Three modes via tabs:

### Tab 1 — Setup
- Embeds existing components: PinBoard, GitHubPanel, PresetsPanel, GeneratePanel
- These components need interface adaptation: `GeneratePanel.onSiteReady` callback will create a new artboard node instead of setting session state. `RefinementChat` props (`siteDir`, `sessionId`, `provider`) will come from the selected artboard node.
- "Generate" button triggers generation → result appears as new artboard on canvas

### Tab 2 — Chat
- Evolution of RefinementChat
- Context: entire canvas state or selected nodes
- When "Edit in chat" is clicked on an artboard, this tab activates with that artboard's context
- Prompt → AI iterates on selected artboard or generates new one
- ClaudeTerminal and ViteSetupTerminal embedded here

### Tab 3 — Inspector
- Appears when a node is selected
- Artboard: preview URL, exclude toggle, viewport preset, "Edit in chat" button
- Image: dimensions, alt text
- Document: markdown editor
- Shape/Widget: label, colors, size

**Width:** 380px, collapsible for full canvas view.

## Export and Sync

### Incremental sync
- Each artboard maps to `output/site-{siteDir}/`
- When artboard content changes (AI iteration), files update immediately
- No manual per-artboard export needed

### Exclude from export
- Toggle on artboard header and in inspector
- Flag: `canvasNode.excludeFromExport = true`

### Full app export (future phase)
> **Note:** Full app export (merging multiple artboards into a routed application) is out of scope for the initial implementation. The incremental sync per artboard and exclude toggles are the MVP export mechanism. Full app export will be designed separately once the canvas workflow is validated.

## Routing and File Structure

### Routes
- `/` — Redirects to `/canvas`
- `/canvas` — Main workspace

### New file structure
```
src/app/canvas/
  page.tsx                  — Canvas page (client component)

src/components/canvas/
  Canvas.tsx                — Main canvas (pan/zoom + node layer)
  CanvasToolbar.tsx         — Top toolbar (shape tools, add image, etc.)
  CanvasNode.tsx            — Dispatcher: node type → renderer
  ArtboardNode.tsx          — Iframe artboard with overlay + interactive mode
  ImageNode.tsx             — Image node
  DocumentNode.tsx          — Markdown document node
  ShapeNode.tsx             — Wireframe shape (roughjs SVG)
  WidgetNode.tsx            — UI widget (roughjs SVG)
  Minimap.tsx               — Bottom-right minimap (bounding-box view)
  Sidebar.tsx               — Refactored sidebar (Setup/Chat/Inspector tabs)
  InspectorPanel.tsx        — Node property inspector

src/lib/canvas-state.ts     — State management (CRUD, undo/redo, persistence)

src/app/api/canvas/
  route.ts                  — GET/PUT canvas state (SQLite)
src/app/api/uploads/
  route.ts                  — POST image upload (multipart → data/uploads/)
```

### Reused components (with interface adaptation)
- PinBoard, GitHubPanel, PresetsPanel, GeneratePanel — embedded in Sidebar Setup tab
- ClaudeTerminal, ViteSetupTerminal — embedded in Sidebar Chat tab
- RefinementChat — evolved into the Chat tab (props sourced from selected artboard node)

### Retired components
- PreviewFrame — replaced by ArtboardNode (iframe directly on canvas)

## Dependencies

### New
- `react-zoom-pan-pinch` — pan/zoom for infinite canvas
- `roughjs` — hand-drawn wireframe rendering (SVG mode)

### Existing (unchanged)
- All current dependencies remain
