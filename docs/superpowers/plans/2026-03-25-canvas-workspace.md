# Canvas Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an infinite canvas workspace at `/canvas` that serves as the central design tool — displaying generated pages as artboards, images, documents, and wireframe shapes/widgets.

**Architecture:** Two-layer canvas (CSS grid background + DOM node layer) using `react-zoom-pan-pinch` for pan/zoom. All nodes are React DOM elements — shapes/widgets rendered as inline SVG via roughjs SVG mode, artboards as iframes. State managed in a custom React hook with undo/redo, persisted to SQLite via API route.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, react-zoom-pan-pinch, roughjs, better-sqlite3

**Spec:** `docs/superpowers/specs/2026-03-25-canvas-workspace-design.md`

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/lib/canvas-types.ts` | TypeScript types for CanvasNode, CanvasState, all node data types |
| `src/lib/canvas-state.ts` | State management: CRUD operations, undo/redo history, auto-save logic |
| `src/lib/canvas-state.test.ts` | Tests for canvas state management |
| `src/app/api/canvas/route.ts` | GET/PUT canvas state from/to SQLite |
| `src/app/api/uploads/route.ts` | POST image upload (multipart → data/uploads/) |
| `src/app/canvas/page.tsx` | Canvas page — client component, mounts Canvas + Sidebar |
| `src/components/canvas/Canvas.tsx` | Main canvas: pan/zoom wrapper, grid background, node layer |
| `src/components/canvas/CanvasToolbar.tsx` | Top toolbar: shape tools, widget palette, add image/doc |
| `src/components/canvas/CanvasNode.tsx` | Dispatcher: routes node.type to correct renderer |
| `src/components/canvas/ShapeNode.tsx` | Wireframe shape rendering (roughjs SVG) |
| `src/components/canvas/WidgetNode.tsx` | UI widget rendering (roughjs SVG) |
| `src/components/canvas/ImageNode.tsx` | Image node with missing-file placeholder |
| `src/components/canvas/DocumentNode.tsx` | Markdown document with inline editing |
| `src/components/canvas/ArtboardNode.tsx` | Iframe artboard with overlay + interactive mode |
| `src/components/canvas/Sidebar.tsx` | Tabbed sidebar: Setup / Chat / Inspector |
| `src/components/canvas/InspectorPanel.tsx` | Node property inspector per type |
| `src/components/canvas/Minimap.tsx` | Bottom-right minimap navigation |

### Modified files
| File | Change |
|------|--------|
| `src/lib/db.ts` | Add `canvas_state` table creation |
| `src/app/page.tsx` | Redirect to `/canvas` |
| `src/components/GeneratePanel.tsx` | Make `onSiteReady` callback signature flexible for canvas use |
| `src/components/Header.tsx` | Update navigation for canvas route |

---

## Task 1: Types and State Management

**Files:**
- Create: `src/lib/canvas-types.ts`
- Create: `src/lib/canvas-state.ts`
- Create: `src/lib/canvas-state.test.ts`

### Step 1.1 — Write canvas types

- [ ] Create `src/lib/canvas-types.ts` with all types from the spec:

```typescript
export type NodeType = 'artboard' | 'image' | 'document' | 'shape' | 'widget'

export type ShapeType = 'rectangle' | 'circle' | 'rounded-rect' | 'line'

export type WidgetType = 'button' | 'cta' | 'input' | 'dropdown' | 'navbar' | 'card' | 'hero' | 'footer' | 'checkbox' | 'toggle'

export type Viewport = 'desktop' | 'tablet' | 'mobile'

export const VIEWPORT_SIZES: Record<Viewport, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
}

export type ArtboardNodeData = {
  name: string
  siteDir: string
  viewport: Viewport
  provider: 'gemini' | 'claude'
  sessionId?: string
  thumbnailUrl?: string
}

export type ImageNodeData = {
  src: string
  alt?: string
}

export type DocNodeData = {
  markdown: string
  title?: string
}

export type ShapeNodeData = {
  shapeType: ShapeType
  label: string
  fillColor?: string
  strokeColor?: string
}

export type WidgetNodeData = {
  widgetType: WidgetType
  label: string
  fillColor?: string
  strokeColor?: string
}

export type CanvasNode = {
  id: string
  type: NodeType
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  excludeFromExport?: boolean
  data: ArtboardNodeData | ImageNodeData | DocNodeData | ShapeNodeData | WidgetNodeData
}

export type CanvasState = {
  nodes: CanvasNode[]
  viewport: { x: number; y: number; zoom: number }
}

export function createEmptyState(): CanvasState {
  return { nodes: [], viewport: { x: 0, y: 0, zoom: 1 } }
}
```

- [ ] Commit: `git add src/lib/canvas-types.ts && git commit -m "feat(canvas): add TypeScript types for canvas state model"`

### Step 1.2 — Write failing tests for canvas state operations

- [ ] Create `src/lib/canvas-state.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  addNode, removeNode, updateNode, moveNode,
  bringToFront, sendToBack, nextZIndex,
  createUndoRedoManager,
} from './canvas-state'
import { CanvasNode, CanvasState, createEmptyState } from './canvas-types'

const makeShape = (id: string, x = 0, y = 0): CanvasNode => ({
  id, type: 'shape', x, y, width: 100, height: 100, zIndex: 0,
  data: { shapeType: 'rectangle', label: 'test' },
})

describe('addNode', () => {
  it('adds a node to empty state', () => {
    const state = createEmptyState()
    const node = makeShape('s1')
    const next = addNode(state, node)
    expect(next.nodes).toHaveLength(1)
    expect(next.nodes[0].id).toBe('s1')
  })

  it('assigns next zIndex automatically', () => {
    let state = createEmptyState()
    state = addNode(state, makeShape('s1'))
    state = addNode(state, makeShape('s2'))
    expect(state.nodes[1].zIndex).toBe(1)
  })
})

describe('removeNode', () => {
  it('removes a node by id', () => {
    let state = createEmptyState()
    state = addNode(state, makeShape('s1'))
    state = addNode(state, makeShape('s2'))
    state = removeNode(state, 's1')
    expect(state.nodes).toHaveLength(1)
    expect(state.nodes[0].id).toBe('s2')
  })

  it('returns same state if id not found', () => {
    const state = addNode(createEmptyState(), makeShape('s1'))
    const next = removeNode(state, 'nonexistent')
    expect(next).toBe(state)
  })
})

describe('updateNode', () => {
  it('updates node properties', () => {
    let state = addNode(createEmptyState(), makeShape('s1', 0, 0))
    state = updateNode(state, 's1', { x: 50, y: 100 })
    expect(state.nodes[0].x).toBe(50)
    expect(state.nodes[0].y).toBe(100)
  })
})

describe('moveNode', () => {
  it('updates x and y', () => {
    let state = addNode(createEmptyState(), makeShape('s1', 10, 20))
    state = moveNode(state, 's1', 50, 60)
    expect(state.nodes[0].x).toBe(50)
    expect(state.nodes[0].y).toBe(60)
  })
})

describe('bringToFront / sendToBack', () => {
  it('bringToFront sets highest zIndex', () => {
    let state = createEmptyState()
    state = addNode(state, makeShape('s1'))
    state = addNode(state, makeShape('s2'))
    state = addNode(state, makeShape('s3'))
    state = bringToFront(state, 's1')
    const node = state.nodes.find(n => n.id === 's1')!
    expect(node.zIndex).toBe(3)
  })

  it('sendToBack sets zIndex 0 and shifts others up', () => {
    let state = createEmptyState()
    state = addNode(state, makeShape('s1'))
    state = addNode(state, makeShape('s2'))
    state = addNode(state, makeShape('s3'))
    state = sendToBack(state, 's3')
    const node = state.nodes.find(n => n.id === 's3')!
    expect(node.zIndex).toBe(0)
  })
})

describe('undo/redo', () => {
  it('undo reverts to previous state', () => {
    const mgr = createUndoRedoManager()
    const s1 = addNode(createEmptyState(), makeShape('s1'))
    mgr.push(s1)
    const s2 = addNode(s1, makeShape('s2'))
    mgr.push(s2)
    const undone = mgr.undo()
    expect(undone?.nodes).toHaveLength(1)
  })

  it('redo restores undone state', () => {
    const mgr = createUndoRedoManager()
    const s1 = addNode(createEmptyState(), makeShape('s1'))
    mgr.push(s1)
    const s2 = addNode(s1, makeShape('s2'))
    mgr.push(s2)
    mgr.undo()
    const redone = mgr.redo()
    expect(redone?.nodes).toHaveLength(2)
  })

  it('push after undo clears redo stack', () => {
    const mgr = createUndoRedoManager()
    mgr.push(addNode(createEmptyState(), makeShape('s1')))
    mgr.push(addNode(createEmptyState(), makeShape('s2')))
    mgr.undo()
    mgr.push(addNode(createEmptyState(), makeShape('s3')))
    expect(mgr.redo()).toBeNull()
  })

  it('respects max history size', () => {
    const mgr = createUndoRedoManager(3)
    for (let i = 0; i < 5; i++) {
      mgr.push(addNode(createEmptyState(), makeShape(`s${i}`)))
    }
    let count = 0
    while (mgr.undo()) count++
    expect(count).toBe(2) // 3 states = 2 undos
  })
})
```

- [ ] Run tests to verify they fail:

```bash
npx vitest run src/lib/canvas-state.test.ts
```

Expected: FAIL — module `./canvas-state` has no exports.

### Step 1.3 — Implement canvas state operations

- [ ] Create `src/lib/canvas-state.ts`:

```typescript
import { CanvasNode, CanvasState } from './canvas-types'

export function nextZIndex(state: CanvasState): number {
  if (state.nodes.length === 0) return 0
  return Math.max(...state.nodes.map(n => n.zIndex)) + 1
}

export function addNode(state: CanvasState, node: CanvasNode): CanvasState {
  const withZ = { ...node, zIndex: nextZIndex(state) }
  return { ...state, nodes: [...state.nodes, withZ] }
}

export function removeNode(state: CanvasState, id: string): CanvasState {
  const filtered = state.nodes.filter(n => n.id !== id)
  if (filtered.length === state.nodes.length) return state
  return { ...state, nodes: filtered }
}

export function updateNode(state: CanvasState, id: string, updates: Partial<CanvasNode>): CanvasState {
  return {
    ...state,
    nodes: state.nodes.map(n => n.id === id ? { ...n, ...updates } : n),
  }
}

export function moveNode(state: CanvasState, id: string, x: number, y: number): CanvasState {
  return updateNode(state, id, { x, y })
}

export function bringToFront(state: CanvasState, id: string): CanvasState {
  return updateNode(state, id, { zIndex: nextZIndex(state) })
}

export function sendToBack(state: CanvasState, id: string): CanvasState {
  const node = state.nodes.find(n => n.id === id)
  if (!node) return state
  return {
    ...state,
    nodes: state.nodes.map(n => {
      if (n.id === id) return { ...n, zIndex: 0 }
      if (n.zIndex < node.zIndex) return { ...n, zIndex: n.zIndex + 1 }
      return n
    }),
  }
}

export type UndoRedoManager = {
  push: (state: CanvasState) => void
  undo: () => CanvasState | null
  redo: () => CanvasState | null
}

export function createUndoRedoManager(maxSize = 50): UndoRedoManager {
  const past: CanvasState[] = []
  const future: CanvasState[] = []

  return {
    push(state: CanvasState) {
      past.push(state)
      future.length = 0
      if (past.length > maxSize) past.shift()
    },
    undo(): CanvasState | null {
      if (past.length <= 1) return null
      const current = past.pop()!
      future.push(current)
      return past[past.length - 1]
    },
    redo(): CanvasState | null {
      if (future.length === 0) return null
      const state = future.pop()!
      past.push(state)
      return state
    },
  }
}
```

- [ ] Run tests:

```bash
npx vitest run src/lib/canvas-state.test.ts
```

Expected: ALL PASS

- [ ] Commit: `git add src/lib/canvas-state.ts src/lib/canvas-state.test.ts && git commit -m "feat(canvas): add state management with CRUD and undo/redo"`

---

## Task 2: Database and API Routes

**Files:**
- Modify: `src/lib/db.ts`
- Create: `src/app/api/canvas/route.ts`
- Create: `src/app/api/uploads/route.ts`

### Step 2.1 — Add canvas_state table to database

- [ ] In `src/lib/db.ts`, add the canvas_state table creation after the existing `projects` table creation:

```sql
CREATE TABLE IF NOT EXISTS canvas_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id),
  state TEXT NOT NULL DEFAULT '{"nodes":[],"viewport":{"x":0,"y":0,"zoom":1}}',
  updated_at TEXT DEFAULT (datetime('now'))
)
```

- [ ] Run `npm run build` to verify no compilation errors.
- [ ] Commit: `git add src/lib/db.ts && git commit -m "feat(canvas): add canvas_state table to SQLite schema"`

### Step 2.2 — Create canvas API route

- [ ] Create `src/app/api/canvas/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  const db = getDb()

  if (!projectId) {
    // Auto-create or fetch default project
    let project = db.prepare('SELECT id FROM projects ORDER BY id LIMIT 1').get() as { id: number } | undefined
    if (!project) {
      const result = db.prepare(
        'INSERT INTO projects (name, site_dir, provider, framework) VALUES (?, ?, ?, ?)'
      ).run('Default Project', `project-${Date.now()}`, 'gemini', 'html')
      project = { id: result.lastInsertRowid as number }
    }
    const row = db.prepare('SELECT state FROM canvas_state WHERE project_id = ?').get(project.id) as { state: string } | undefined
    if (!row) {
      const defaultState = JSON.stringify({ nodes: [], viewport: { x: 0, y: 0, zoom: 1 } })
      db.prepare('INSERT INTO canvas_state (project_id, state) VALUES (?, ?)').run(project.id, defaultState)
      return NextResponse.json({ projectId: project.id, state: JSON.parse(defaultState) })
    }
    return NextResponse.json({ projectId: project.id, state: JSON.parse(row.state) })
  }

  const row = db.prepare('SELECT state FROM canvas_state WHERE project_id = ?').get(Number(projectId)) as { state: string } | undefined
  if (!row) {
    return NextResponse.json({ error: 'Canvas not found' }, { status: 404 })
  }
  return NextResponse.json({ projectId: Number(projectId), state: JSON.parse(row.state) })
}

export async function PUT(req: NextRequest) {
  const { projectId, state } = await req.json()
  const db = getDb()

  const existing = db.prepare('SELECT id FROM canvas_state WHERE project_id = ?').get(projectId)
  if (existing) {
    db.prepare('UPDATE canvas_state SET state = ?, updated_at = datetime(?) WHERE project_id = ?')
      .run(JSON.stringify(state), new Date().toISOString(), projectId)
  } else {
    db.prepare('INSERT INTO canvas_state (project_id, state) VALUES (?, ?)')
      .run(projectId, JSON.stringify(state))
  }

  return NextResponse.json({ ok: true })
}

// POST handler for navigator.sendBeacon (which always sends POST)
export async function POST(req: NextRequest) {
  return PUT(req)
}
```

- [ ] Run `npm run build` to verify compilation.
- [ ] Commit: `git add src/app/api/canvas/route.ts && git commit -m "feat(canvas): add GET/PUT API route for canvas state"`

### Step 2.3 — Create uploads API route

- [ ] Create `src/app/api/uploads/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads')

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  await mkdir(UPLOADS_DIR, { recursive: true })

  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filename = `${timestamp}-${safeName}`
  const filepath = path.join(UPLOADS_DIR, filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filepath, buffer)

  return NextResponse.json({ path: `uploads/${filename}` })
}
```

- [ ] Run `npm run build` to verify compilation.
- [ ] Commit: `git add src/app/api/uploads/route.ts && git commit -m "feat(canvas): add image upload API route"`

---

## Task 3: Canvas Core — Pan/Zoom and Grid

**Files:**
- Create: `src/app/canvas/page.tsx`
- Create: `src/components/canvas/Canvas.tsx`

### Step 3.1 — Install dependencies

- [ ] Install:

```bash
cd /Users/csacsi/DEV/PinLaunch && npm install react-zoom-pan-pinch roughjs
```

- [ ] Commit: `git add package.json package-lock.json && git commit -m "feat(canvas): add react-zoom-pan-pinch and roughjs dependencies"`

### Step 3.2 — Create Canvas component with pan/zoom and grid

- [ ] Create `src/components/canvas/Canvas.tsx`:

```typescript
'use client'

import { useRef, useCallback, useState, ReactNode } from 'react'
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'

interface CanvasProps {
  children: ReactNode
  onTransformChange?: (x: number, y: number, zoom: number) => void
}

export default function Canvas({ children, onTransformChange }: CanvasProps) {
  const transformRef = useRef<ReactZoomPanPinchRef>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })

  const handleTransform = useCallback((_: unknown, state: { positionX: number; positionY: number; scale: number }) => {
    setTransform({ x: state.positionX, y: state.positionY, scale: state.scale })
    onTransformChange?.(state.positionX, state.positionY, state.scale)
  }, [onTransformChange])

  // Expose current zoom scale for child components (drag handling)
  const getZoom = useCallback(() => transform.scale, [transform.scale])

  // Grid scales with zoom: backgroundSize and backgroundPosition track the transform
  const gridSize = 24 * transform.scale
  const gridOffsetX = transform.x % gridSize
  const gridOffsetY = transform.y % gridSize

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Grid background — scales and pans with canvas */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
        }}
      />

      <TransformWrapper
        ref={transformRef}
        minScale={0.1}
        maxScale={4}
        initialScale={1}
        initialPositionX={0}
        initialPositionY={0}
        limitToBounds={false}
        panning={{ velocityDisabled: true }}
        onTransformed={handleTransform}
        doubleClick={{ disabled: true }}
      >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: '100%', height: '100%' }}
        >
          <div className="relative" style={{ width: '10000px', height: '10000px' }}>
            {children}
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}
```

- [ ] Commit: `git add src/components/canvas/Canvas.tsx && git commit -m "feat(canvas): add Canvas component with pan/zoom and dot grid"`

### Step 3.3 — Create canvas page

- [ ] Create `src/app/canvas/page.tsx`:

```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Canvas from '@/components/canvas/Canvas'
import { CanvasState, CanvasNode, createEmptyState } from '@/lib/canvas-types'
import { addNode, removeNode, updateNode, moveNode, bringToFront, sendToBack, createUndoRedoManager } from '@/lib/canvas-state'

export default function CanvasPage() {
  const [state, setState] = useState<CanvasState>(createEmptyState())
  const [projectId, setProjectId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const undoMgr = useRef(createUndoRedoManager())
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  // Load canvas state on mount
  useEffect(() => {
    fetch('/api/canvas')
      .then(r => r.json())
      .then(data => {
        setProjectId(data.projectId)
        setState(data.state)
        undoMgr.current.push(data.state)
      })
  }, [])

  // Auto-save (debounced 500ms)
  const saveState = useCallback((newState: CanvasState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (projectId === null) return
      fetch('/api/canvas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, state: newState }),
      })
    }, 500)
  }, [projectId])

  // State update with undo tracking and auto-save
  const pushState = useCallback((newState: CanvasState) => {
    setState(newState)
    undoMgr.current.push(newState)
    saveState(newState)
  }, [saveState])

  const handleUndo = useCallback(() => {
    const prev = undoMgr.current.undo()
    if (prev) { setState(prev); saveState(prev) }
  }, [saveState])

  const handleRedo = useCallback(() => {
    const next = undoMgr.current.redo()
    if (next) { setState(next); saveState(next) }
  }, [saveState])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault(); handleRedo()
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); handleUndo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        e.preventDefault()
        let s = state
        for (const id of selectedIds) s = removeNode(s, id)
        pushState(s)
        setSelectedIds(new Set())
      } else if (e.key === 'Escape') {
        setSelectedIds(new Set())
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, selectedIds, pushState, handleUndo, handleRedo])

  // beforeunload save
  useEffect(() => {
    const handler = () => {
      if (projectId === null) return
      const blob = new Blob([JSON.stringify({ projectId, state })], { type: 'application/json' })
      navigator.sendBeacon('/api/canvas', blob)
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [projectId, state])

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Sidebar placeholder — Task 7 */}
      <div className="w-[380px] shrink-0 border-r" style={{ borderColor: 'var(--border)' }}>
        <div className="p-4 text-sm opacity-50">Sidebar — coming soon</div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <Canvas>
          {/* Empty state */}
          {state.nodes.length === 0 && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center opacity-50">
              <p className="text-lg mb-2">Start by adding pins and generating your first page in the Setup tab</p>
              <p className="text-sm">← Use the sidebar to get started</p>
            </div>
          )}

          {/* Nodes will be rendered here — Tasks 4-6 */}
        </Canvas>
      </div>
    </div>
  )
}
```

- [ ] Run `npm run dev` and visit `http://localhost:3000/canvas`. Verify:
  - Dot grid background visible
  - Pan with scroll/trackpad works
  - Zoom with Ctrl+scroll/pinch works
  - Empty state message shows
  - Sidebar placeholder on left

- [ ] Commit: `git add src/app/canvas/page.tsx && git commit -m "feat(canvas): add /canvas page with pan/zoom canvas and state management"`

### Step 3.4 — Redirect root to /canvas

- [ ] Replace `src/app/page.tsx` content with redirect:

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/canvas')
}
```

- [ ] Run `npm run dev`, visit `http://localhost:3000`, verify it redirects to `/canvas`.
- [ ] Commit: `git add src/app/page.tsx && git commit -m "feat(canvas): redirect / to /canvas"`

---

## Task 4: Shape and Widget Nodes (roughjs)

**Files:**
- Create: `src/components/canvas/ShapeNode.tsx`
- Create: `src/components/canvas/WidgetNode.tsx`
- Create: `src/components/canvas/CanvasNode.tsx`
- Modify: `src/app/canvas/page.tsx`

### Step 4.1 — Create ShapeNode component

- [ ] Create `src/components/canvas/ShapeNode.tsx`:

```typescript
'use client'

import { useEffect, useRef } from 'react'
import rough from 'roughjs'
import type { ShapeNodeData } from '@/lib/canvas-types'

interface ShapeNodeProps {
  width: number
  height: number
  data: ShapeNodeData
  selected: boolean
  onMouseDown: (e: React.MouseEvent) => void
}

export default function ShapeNode({ width, height, data, selected, onMouseDown }: ShapeNodeProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = svgRef.current
    // Clear previous
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const rc = rough.svg(svg)
    const options = {
      fill: data.fillColor || 'transparent',
      stroke: data.strokeColor || 'var(--text)',
      fillStyle: 'solid' as const,
      roughness: 1.5,
    }

    let node: SVGGElement
    switch (data.shapeType) {
      case 'rectangle':
        node = rc.rectangle(2, 2, width - 4, height - 4, options)
        break
      case 'circle':
        node = rc.circle(width / 2, height / 2, Math.min(width, height) - 4, options)
        break
      case 'rounded-rect':
        node = rc.rectangle(2, 2, width - 4, height - 4, { ...options, roughness: 0.5 })
        break
      case 'line':
        node = rc.line(2, height / 2, width - 2, height / 2, options)
        break
    }
    svg.appendChild(node)
  }, [width, height, data])

  return (
    <div
      className="relative cursor-move"
      style={{
        width, height,
        outline: selected ? '2px solid #3b82f6' : 'none',
        outlineOffset: '2px',
      }}
      onMouseDown={onMouseDown}
    >
      <svg ref={svgRef} width={width} height={height} className="absolute inset-0" />
      {data.label && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-sm px-2 text-center" style={{ color: 'var(--text)' }}>{data.label}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] Commit: `git add src/components/canvas/ShapeNode.tsx && git commit -m "feat(canvas): add ShapeNode with roughjs SVG rendering"`

### Step 4.2 — Create WidgetNode component

- [ ] Create `src/components/canvas/WidgetNode.tsx`:

```typescript
'use client'

import { useEffect, useRef } from 'react'
import rough from 'roughjs'
import type { WidgetNodeData } from '@/lib/canvas-types'

interface WidgetNodeProps {
  width: number
  height: number
  data: WidgetNodeData
  selected: boolean
  onMouseDown: (e: React.MouseEvent) => void
}

const WIDGET_SHAPES: Record<string, (rc: ReturnType<typeof rough.svg>, w: number, h: number, opts: object) => SVGGElement> = {
  button: (rc, w, h, opts) => rc.rectangle(2, 2, w - 4, h - 4, { ...opts, roughness: 0.3 }),
  cta: (rc, w, h, opts) => rc.rectangle(2, 2, w - 4, h - 4, { ...opts, roughness: 0.3, fill: '#3b82f6', fillStyle: 'solid' }),
  input: (rc, w, h, opts) => rc.rectangle(2, 2, w - 4, h - 4, { ...opts, roughness: 0.2 }),
  dropdown: (rc, w, h, opts) => rc.rectangle(2, 2, w - 4, h - 4, { ...opts, roughness: 0.2 }),
  navbar: (rc, w, h, opts) => rc.rectangle(2, 2, w - 4, h - 4, { ...opts, roughness: 0.5 }),
  card: (rc, w, h, opts) => rc.rectangle(4, 4, w - 8, h - 8, { ...opts, roughness: 0.8 }),
  hero: (rc, w, h, opts) => rc.rectangle(2, 2, w - 4, h - 4, { ...opts, roughness: 0.6 }),
  footer: (rc, w, h, opts) => rc.rectangle(2, 2, w - 4, h - 4, { ...opts, roughness: 0.5 }),
  checkbox: (rc, w, h, opts) => rc.rectangle(w / 2 - 8, h / 2 - 8, 16, 16, { ...opts, roughness: 1 }),
  toggle: (rc, w, h, opts) => rc.rectangle(w / 2 - 16, h / 2 - 8, 32, 16, { ...opts, roughness: 0.5 }),
}

export default function WidgetNode({ width, height, data, selected, onMouseDown }: WidgetNodeProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = svgRef.current
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const rc = rough.svg(svg)
    const opts = {
      stroke: data.strokeColor || 'var(--text)',
      fill: data.fillColor || 'transparent',
      fillStyle: 'solid' as const,
    }

    const shapeFn = WIDGET_SHAPES[data.widgetType] || WIDGET_SHAPES.button
    svg.appendChild(shapeFn(rc, width, height, opts))

    // Dropdown arrow indicator
    if (data.widgetType === 'dropdown') {
      svg.appendChild(rc.line(width - 20, height / 2 - 3, width - 14, height / 2 + 3, opts))
      svg.appendChild(rc.line(width - 14, height / 2 + 3, width - 8, height / 2 - 3, opts))
    }
  }, [width, height, data])

  return (
    <div
      className="relative cursor-move"
      style={{
        width, height,
        outline: selected ? '2px solid #3b82f6' : 'none',
        outlineOffset: '2px',
      }}
      onMouseDown={onMouseDown}
    >
      <svg ref={svgRef} width={width} height={height} className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-xs px-2 text-center" style={{ color: 'var(--text)' }}>{data.label}</span>
      </div>
    </div>
  )
}
```

- [ ] Commit: `git add src/components/canvas/WidgetNode.tsx && git commit -m "feat(canvas): add WidgetNode with roughjs SVG rendering"`

### Step 4.3 — Create CanvasNode dispatcher

- [ ] Create `src/components/canvas/CanvasNode.tsx`:

```typescript
'use client'

import { useCallback, useRef, useState } from 'react'
import type { CanvasNode as CanvasNodeType } from '@/lib/canvas-types'
import ShapeNode from './ShapeNode'
import WidgetNode from './WidgetNode'

interface CanvasNodeProps {
  node: CanvasNodeType
  selected: boolean
  zoom: number  // current zoom scale for accurate drag
  onSelect: (id: string, shiftKey: boolean) => void
  onMove: (id: string, x: number, y: number) => void
}

export default function CanvasNodeComponent({ node, selected, zoom, onSelect, onMove }: CanvasNodeProps) {
  const dragRef = useRef<{ startX: number; startY: number; nodeX: number; nodeY: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(node.id, e.shiftKey)
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      nodeX: node.x, nodeY: node.y,
    }
    setDragging(true)

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const dx = (e.clientX - dragRef.current.startX) / zoom
      const dy = (e.clientY - dragRef.current.startY) / zoom
      onMove(node.id, dragRef.current.nodeX + dx, dragRef.current.nodeY + dy)
    }

    const handleMouseUp = () => {
      dragRef.current = null
      setDragging(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [node.id, node.x, node.y, onSelect, onMove])

  const renderContent = () => {
    switch (node.type) {
      case 'shape':
        return <ShapeNode width={node.width} height={node.height} data={node.data as any} selected={selected} onMouseDown={handleMouseDown} />
      case 'widget':
        return <WidgetNode width={node.width} height={node.height} data={node.data as any} selected={selected} onMouseDown={handleMouseDown} />
      case 'image':
      case 'document':
      case 'artboard':
        // Placeholder — Tasks 5-6
        return (
          <div
            style={{ width: node.width, height: node.height, outline: selected ? '2px solid #3b82f6' : '1px dashed var(--border)', outlineOffset: '2px' }}
            className="flex items-center justify-center text-sm opacity-50 cursor-move"
            onMouseDown={handleMouseDown}
          >
            {node.type} (coming soon)
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div
      className="absolute"
      style={{
        left: node.x,
        top: node.y,
        zIndex: node.zIndex,
        cursor: dragging ? 'grabbing' : undefined,
      }}
    >
      {renderContent()}
    </div>
  )
}
```

- [ ] Commit: `git add src/components/canvas/CanvasNode.tsx && git commit -m "feat(canvas): add CanvasNode dispatcher with drag support"`

### Step 4.4 — Wire nodes into canvas page

- [ ] Update `src/app/canvas/page.tsx` to render nodes. Add inside the `<Canvas>` children, after the empty state block:

```typescript
{/* Render nodes */}
{state.nodes.map(node => (
  <CanvasNodeComponent
    key={node.id}
    node={node}
    selected={selectedIds.has(node.id)}
    onSelect={(id, shift) => {
      setSelectedIds(prev => {
        const next = new Set(shift ? prev : [])
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }}
    onMove={(id, x, y) => {
      pushState(moveNode(state, id, x, y))
    }}
  />
))}
```

Add the import at the top:
```typescript
import CanvasNodeComponent from '@/components/canvas/CanvasNode'
```

- [ ] Test manually: Add a temporary shape node to the initial state in `createEmptyState()` for visual verification, then remove it.
- [ ] Commit: `git add src/app/canvas/page.tsx && git commit -m "feat(canvas): render nodes on canvas with selection and drag"`

---

## Task 5: Image and Document Nodes

**Files:**
- Create: `src/components/canvas/ImageNode.tsx`
- Create: `src/components/canvas/DocumentNode.tsx`
- Modify: `src/components/canvas/CanvasNode.tsx`

### Step 5.1 — Create ImageNode

- [ ] Create `src/components/canvas/ImageNode.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { ImageNodeData } from '@/lib/canvas-types'

interface ImageNodeProps {
  width: number
  height: number
  data: ImageNodeData
  selected: boolean
  onMouseDown: (e: React.MouseEvent) => void
}

export default function ImageNode({ width, height, data, selected, onMouseDown }: ImageNodeProps) {
  const [error, setError] = useState(false)
  const src = data.src.startsWith('http') ? data.src : `/api/uploads/${data.src.replace('uploads/', '')}`

  return (
    <div
      className="relative cursor-move"
      style={{
        width, height,
        outline: selected ? '2px solid #3b82f6' : 'none',
        outlineOffset: '2px',
      }}
      onMouseDown={onMouseDown}
    >
      {error ? (
        <div
          className="w-full h-full flex items-center justify-center text-sm opacity-50"
          style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}
        >
          Missing image
        </div>
      ) : (
        <img
          src={src}
          alt={data.alt || ''}
          className="w-full h-full object-cover"
          style={{ borderRadius: 'var(--radius-sm)' }}
          onError={() => setError(true)}
          draggable={false}
        />
      )}
    </div>
  )
}
```

- [ ] Commit: `git add src/components/canvas/ImageNode.tsx && git commit -m "feat(canvas): add ImageNode with missing-file placeholder"`

### Step 5.2 — Create DocumentNode

- [ ] Create `src/components/canvas/DocumentNode.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import type { DocNodeData } from '@/lib/canvas-types'

interface DocumentNodeProps {
  width: number
  height: number
  data: DocNodeData
  selected: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onUpdateData: (data: DocNodeData) => void
}

// Simple markdown-to-HTML (headers, bold, italic, lists, paragraphs)
function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:600;margin:8px 0 4px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:600;margin:8px 0 4px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:700;margin:8px 0 4px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

export default function DocumentNode({ width, height, data, selected, onMouseDown, onUpdateData }: DocumentNodeProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.markdown)

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setEditing(true)
    setDraft(data.markdown)
  }, [data.markdown])

  const handleBlur = useCallback(() => {
    setEditing(false)
    if (draft !== data.markdown) {
      onUpdateData({ ...data, markdown: draft })
    }
  }, [draft, data, onUpdateData])

  return (
    <div
      className="relative cursor-move overflow-auto"
      style={{
        width, height,
        background: 'rgba(var(--surface-rgb, 30, 30, 34), 0.85)',
        borderRadius: 'var(--radius-md)',
        outline: selected ? '2px solid #3b82f6' : '1px solid var(--border)',
        outlineOffset: selected ? '2px' : '0',
        padding: '12px',
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {data.title && (
        <div className="text-xs font-semibold mb-2 opacity-60 uppercase tracking-wider">{data.title}</div>
      )}
      {editing ? (
        <textarea
          className="w-full h-full bg-transparent text-sm resize-none focus:outline-none"
          style={{ color: 'var(--text)', fontFamily: 'monospace' }}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          autoFocus
        />
      ) : (
        <div
          className="text-sm leading-relaxed"
          style={{ color: 'var(--text)' }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(data.markdown) }}
        />
      )}
    </div>
  )
}
```

- [ ] Commit: `git add src/components/canvas/DocumentNode.tsx && git commit -m "feat(canvas): add DocumentNode with inline markdown editing"`

### Step 5.3 — Wire ImageNode and DocumentNode into CanvasNode

- [ ] Update `src/components/canvas/CanvasNode.tsx` — add imports and replace the placeholder cases:

Add imports:
```typescript
import ImageNode from './ImageNode'
import DocumentNode from './DocumentNode'
```

Replace the `case 'image'` and `case 'document'` placeholder blocks with:
```typescript
case 'image':
  return <ImageNode width={node.width} height={node.height} data={node.data as any} selected={selected} onMouseDown={handleMouseDown} />
case 'document':
  return <DocumentNode width={node.width} height={node.height} data={node.data as any} selected={selected} onMouseDown={handleMouseDown} onUpdateData={(newData) => onUpdateData?.(newData)} />
```

Add `onUpdateData` to the `CanvasNodeProps` interface and pass it through from the parent.

- [ ] Run `npm run dev`, verify shapes, images, and documents render.
- [ ] Commit: `git add src/components/canvas/CanvasNode.tsx && git commit -m "feat(canvas): wire ImageNode and DocumentNode into dispatcher"`

---

## Task 6: Artboard Node

**Files:**
- Create: `src/components/canvas/ArtboardNode.tsx`
- Modify: `src/components/canvas/CanvasNode.tsx`

### Step 6.1 — Create ArtboardNode with iframe and overlay

- [ ] Create `src/components/canvas/ArtboardNode.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import type { ArtboardNodeData } from '@/lib/canvas-types'

interface ArtboardNodeProps {
  width: number
  height: number
  data: ArtboardNodeData
  selected: boolean
  isVisible: boolean  // viewport intersection check from parent
  onMouseDown: (e: React.MouseEvent) => void
  onToggleExclude: () => void
  onEditInChat: () => void
}

export default function ArtboardNode({ width, height, data, selected, isVisible, onMouseDown, onToggleExclude, onEditInChat }: ArtboardNodeProps) {
  const [interactive, setInteractive] = useState(false)

  const previewUrl = `/api/preview/${data.siteDir}/?t=${Date.now()}`

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setInteractive(true)
  }, [])

  const handleExitInteractive = useCallback(() => {
    setInteractive(false)
  }, [])

  return (
    <div
      className="relative"
      style={{
        width, height: height + 36, // +36 for header
        outline: selected ? '2px solid #3b82f6' : 'none',
        outlineOffset: '2px',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-3 cursor-move"
        style={{
          height: 36,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
          borderBottom: '1px solid var(--border)',
          fontSize: '12px',
        }}
        onMouseDown={onMouseDown}
      >
        <span className="font-medium truncate flex-1" style={{ color: 'var(--text)' }}>{data.name}</span>
        <span className="opacity-50 text-xs">{data.viewport}</span>
        <button
          className="opacity-50 hover:opacity-100 text-xs px-1"
          onClick={(e) => { e.stopPropagation(); onToggleExclude() }}
          title="Toggle export"
        >
          {/* Export toggle icon placeholder */}
          &#x2713;
        </button>
        <button
          className="opacity-50 hover:opacity-100 text-xs px-1"
          onClick={(e) => { e.stopPropagation(); onEditInChat() }}
          title="Edit in chat"
        >
          Edit
        </button>
      </div>

      {/* Iframe area */}
      <div
        className="relative overflow-hidden"
        style={{
          width, height,
          background: '#fff',
          borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
        }}
        onDoubleClick={handleDoubleClick}
      >
        {isVisible ? (
          <>
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              style={{ pointerEvents: interactive ? 'auto' : 'none' }}
              title={data.name}
            />
            {/* Transparent overlay for drag/pan when not interactive */}
            {!interactive && (
              <div className="absolute inset-0 cursor-move" onMouseDown={onMouseDown} />
            )}
          </>
        ) : (
          // Off-screen thumbnail placeholder
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--surface)' }}>
            {data.thumbnailUrl ? (
              <img src={data.thumbnailUrl} alt={data.name} className="w-full h-full object-cover object-top" />
            ) : (
              <span className="text-sm opacity-50">{data.name}</span>
            )}
          </div>
        )}
      </div>

      {/* Exit interactive mode overlay */}
      {interactive && (
        <button
          className="absolute -top-8 right-0 text-xs px-2 py-1 rounded"
          style={{ background: '#3b82f6', color: '#fff' }}
          onClick={handleExitInteractive}
        >
          Exit interactive mode (Esc)
        </button>
      )}
    </div>
  )
}
```

- [ ] Commit: `git add src/components/canvas/ArtboardNode.tsx && git commit -m "feat(canvas): add ArtboardNode with iframe overlay and interactive mode"`

### Step 6.2 — Wire ArtboardNode into CanvasNode

- [ ] Update `src/components/canvas/CanvasNode.tsx` — add import and replace artboard placeholder:

```typescript
import ArtboardNode from './ArtboardNode'
```

Replace `case 'artboard'` with:
```typescript
case 'artboard':
  return (
    <ArtboardNode
      width={node.width}
      height={node.height}
      data={node.data as any}
      selected={selected}
      isVisible={true} // TODO: viewport intersection check
      onMouseDown={handleMouseDown}
      onToggleExclude={() => onToggleExclude?.(node.id)}
      onEditInChat={() => onEditInChat?.(node.id)}
    />
  )
```

Add `onToggleExclude` and `onEditInChat` to `CanvasNodeProps`.

- [ ] Run `npm run dev`, verify page still works.
- [ ] Commit: `git add src/components/canvas/CanvasNode.tsx && git commit -m "feat(canvas): wire ArtboardNode into dispatcher"`

---

## Task 7: Toolbar

**Files:**
- Create: `src/components/canvas/CanvasToolbar.tsx`
- Modify: `src/app/canvas/page.tsx`

### Step 7.1 — Create toolbar component

- [ ] Create `src/components/canvas/CanvasToolbar.tsx`:

```typescript
'use client'

import { useState, useCallback, useRef } from 'react'
import type { NodeType, ShapeType, WidgetType } from '@/lib/canvas-types'

type ToolMode = 'select' | 'shape' | 'widget'

interface CanvasToolbarProps {
  onAddShape: (shapeType: ShapeType, x: number, y: number) => void
  onAddWidget: (widgetType: WidgetType, x: number, y: number) => void
  onAddDocument: () => void
  onAddImage: (file: File) => void
}

const SHAPES: { type: ShapeType; label: string }[] = [
  { type: 'rectangle', label: 'Rect' },
  { type: 'circle', label: 'Circle' },
  { type: 'rounded-rect', label: 'Rounded' },
  { type: 'line', label: 'Line' },
]

const WIDGETS: { type: WidgetType; label: string }[] = [
  { type: 'button', label: 'Button' },
  { type: 'cta', label: 'CTA' },
  { type: 'input', label: 'Input' },
  { type: 'dropdown', label: 'Dropdown' },
  { type: 'navbar', label: 'Navbar' },
  { type: 'card', label: 'Card' },
  { type: 'hero', label: 'Hero' },
  { type: 'footer', label: 'Footer' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'toggle', label: 'Toggle' },
]

export default function CanvasToolbar({ onAddShape, onAddWidget, onAddDocument, onAddImage }: CanvasToolbarProps) {
  const [showShapes, setShowShapes] = useState(false)
  const [showWidgets, setShowWidgets] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const btnClass = "px-3 py-1.5 text-xs rounded-md hover:bg-white/10 transition-colors"
  const dropdownClass = "absolute top-full mt-1 left-0 rounded-lg p-1 flex flex-col gap-0.5 min-w-[120px] z-50"

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-lg z-50"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Shapes dropdown */}
      <div className="relative">
        <button className={btnClass} onClick={() => { setShowShapes(!showShapes); setShowWidgets(false) }}>
          Shapes
        </button>
        {showShapes && (
          <div className={dropdownClass} style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {SHAPES.map(s => (
              <button
                key={s.type}
                className={btnClass + ' text-left'}
                onClick={() => { onAddShape(s.type, 200, 200); setShowShapes(false) }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Widgets dropdown */}
      <div className="relative">
        <button className={btnClass} onClick={() => { setShowWidgets(!showWidgets); setShowShapes(false) }}>
          Widgets
        </button>
        {showWidgets && (
          <div className={dropdownClass} style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {WIDGETS.map(w => (
              <button
                key={w.type}
                className={btnClass + ' text-left'}
                onClick={() => { onAddWidget(w.type, 200, 200); setShowWidgets(false) }}
              >
                {w.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

      {/* Add Image */}
      <button className={btnClass} onClick={() => fileInputRef.current?.click()}>
        Image
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) onAddImage(e.target.files[0])
          e.target.value = ''
        }}
      />

      {/* Add Document */}
      <button className={btnClass} onClick={onAddDocument}>
        Doc
      </button>
    </div>
  )
}
```

- [ ] Commit: `git add src/components/canvas/CanvasToolbar.tsx && git commit -m "feat(canvas): add CanvasToolbar with shape/widget/image/doc creation"`

### Step 7.2 — Wire toolbar into canvas page

- [ ] Update `src/app/canvas/page.tsx`:

Add import:
```typescript
import CanvasToolbar from '@/components/canvas/CanvasToolbar'
```

Add node creation handlers and render the toolbar above the `<Canvas>` component. The handlers should create new `CanvasNode` objects with appropriate defaults (shapes: 150x100, widgets: 120x40, documents: 300x200) and call `pushState(addNode(state, newNode))`.

Use `crypto.randomUUID()` for node IDs.

- [ ] Run `npm run dev`, test:
  - Click "Shapes" → "Rect" → rectangle appears on canvas
  - Click "Widgets" → "Button" → button widget appears
  - Click "Doc" → document node appears with placeholder markdown
  - Drag nodes around, verify persistence (refresh page, nodes should be there)

- [ ] Commit: `git add src/app/canvas/page.tsx && git commit -m "feat(canvas): wire toolbar node creation into canvas page"`

---

## Task 8: Sidebar — Setup and Chat Tabs

**Files:**
- Create: `src/components/canvas/Sidebar.tsx`
- Modify: `src/app/canvas/page.tsx`

### Step 8.1 — Create Sidebar with Setup tab

- [ ] Create `src/components/canvas/Sidebar.tsx`:

```typescript
'use client'

import { useState } from 'react'
import PinBoard from '@/components/PinBoard'
import GitHubPanel from '@/components/GitHubPanel'
import PresetsPanel from '@/components/PresetsPanel'
import GeneratePanel from '@/components/GeneratePanel'
import type { CanvasNode } from '@/lib/canvas-types'

type SidebarTab = 'setup' | 'chat' | 'inspector'

interface SidebarProps {
  selectedNode: CanvasNode | null
  provider: string  // from settings DB, managed by canvas page
  onSiteReady: (siteDir: string, sessionId?: string, provider?: string, previewUrl?: string, isVite?: boolean) => void
  onFileChange: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function Sidebar({ selectedNode, provider, onSiteReady, onFileChange, collapsed, onToggleCollapse }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('setup')

  if (collapsed) {
    return (
      <button
        className="absolute left-0 top-1/2 -translate-y-1/2 z-40 px-1.5 py-4 rounded-r-lg"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: 'none' }}
        onClick={onToggleCollapse}
      >
        <span className="text-xs" style={{ writingMode: 'vertical-lr' }}>Sidebar</span>
      </button>
    )
  }

  const tabClass = (tab: SidebarTab) =>
    `px-3 py-2 text-xs font-medium transition-colors ${activeTab === tab ? 'border-b-2' : 'opacity-50 hover:opacity-100'}`

  return (
    <div
      className="w-[380px] shrink-0 flex flex-col h-full"
      style={{ background: 'var(--bg)', borderRight: '1px solid var(--border)' }}
    >
      {/* Tab bar */}
      <div className="flex items-center border-b" style={{ borderColor: 'var(--border)' }}>
        <button className={tabClass('setup')} style={activeTab === 'setup' ? { borderColor: 'var(--accent)' } : {}} onClick={() => setActiveTab('setup')}>Setup</button>
        <button className={tabClass('chat')} style={activeTab === 'chat' ? { borderColor: 'var(--accent)' } : {}} onClick={() => setActiveTab('chat')}>Chat</button>
        <button className={tabClass('inspector')} style={activeTab === 'inspector' ? { borderColor: 'var(--accent)' } : {}} onClick={() => setActiveTab('inspector')}>Inspector</button>
        <div className="flex-1" />
        <button className="px-2 py-1 text-xs opacity-50 hover:opacity-100" onClick={onToggleCollapse}>Hide</button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'setup' && (
          <div className="flex flex-col gap-4">
            <PinBoard />
            <GitHubPanel />
            <PresetsPanel />
            <GeneratePanel
              provider={provider}
              onSiteReady={onSiteReady}
              onFileChange={onFileChange}
            />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="text-sm opacity-50">
            {selectedNode?.type === 'artboard'
              ? `Editing: ${(selectedNode.data as any).name}`
              : 'Select an artboard to start chatting'
            }
            {/* RefinementChat integration — wire in next iteration */}
          </div>
        )}

        {activeTab === 'inspector' && (
          <div className="text-sm opacity-50">
            {selectedNode
              ? `Selected: ${selectedNode.type} node`
              : 'Select a node to inspect'
            }
            {/* InspectorPanel — Task 9 */}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] Commit: `git add src/components/canvas/Sidebar.tsx && git commit -m "feat(canvas): add Sidebar with Setup/Chat/Inspector tabs"`

### Step 8.2 — Wire Sidebar into canvas page

- [ ] Update `src/app/canvas/page.tsx`:
  - Import `Sidebar`
  - Replace the sidebar placeholder `<div>` with `<Sidebar>`
  - Pass `selectedNode` (derived from `selectedIds` + `state.nodes`), `onSiteReady` (creates artboard node), `onFileChange`, collapse state
  - The `onSiteReady` handler creates a new artboard node:

```typescript
const handleSiteReady = useCallback((siteDir: string, sessionId?: string, provider?: string, previewUrl?: string, isVite?: boolean) => {
  const viewport = 'desktop'
  const { width, height } = VIEWPORT_SIZES[viewport]
  const node: CanvasNode = {
    id: crypto.randomUUID(),
    type: 'artboard',
    x: state.nodes.length * 100, // stagger horizontally
    y: 100,
    width, height,
    zIndex: 0,
    data: {
      name: siteDir.replace('site-', ''),
      siteDir,
      viewport,
      provider: (provider || 'gemini') as 'gemini' | 'claude',
      sessionId,
    },
  }
  pushState(addNode(state, node))
}, [state, pushState])
```

- [ ] Run `npm run dev`, test:
  - Sidebar shows with tabs
  - Setup tab shows PinBoard, GitHubPanel, etc.
  - Collapse/expand works
  - (If Gemini key configured) Generate → artboard appears on canvas with iframe preview

- [ ] Commit: `git add src/app/canvas/page.tsx && git commit -m "feat(canvas): wire Sidebar with artboard generation flow"`

---

## Task 9: Inspector Panel

**Files:**
- Create: `src/components/canvas/InspectorPanel.tsx`
- Modify: `src/components/canvas/Sidebar.tsx`

### Step 9.1 — Create InspectorPanel

- [ ] Create `src/components/canvas/InspectorPanel.tsx`:

```typescript
'use client'

import type { CanvasNode, ArtboardNodeData, ImageNodeData, DocNodeData, ShapeNodeData, WidgetNodeData, Viewport } from '@/lib/canvas-types'
import { VIEWPORT_SIZES } from '@/lib/canvas-types'

interface InspectorPanelProps {
  node: CanvasNode
  onUpdate: (updates: Partial<CanvasNode>) => void
  onUpdateData: (data: any) => void
  onDelete: () => void
  onBringToFront: () => void
  onSendToBack: () => void
  onEditInChat?: () => void
}

export default function InspectorPanel({ node, onUpdate, onUpdateData, onDelete, onBringToFront, onSendToBack, onEditInChat }: InspectorPanelProps) {
  const labelClass = "text-xs font-medium opacity-60 uppercase tracking-wider mb-1"
  const inputClass = "w-full px-2 py-1.5 text-sm rounded-md bg-transparent"

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className={labelClass}>Type</div>
        <div className="text-sm capitalize">{node.type}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className={labelClass}>X</div>
          <input className={inputClass} style={{ border: '1px solid var(--border)' }} type="number" value={Math.round(node.x)} onChange={e => onUpdate({ x: Number(e.target.value) })} />
        </div>
        <div>
          <div className={labelClass}>Y</div>
          <input className={inputClass} style={{ border: '1px solid var(--border)' }} type="number" value={Math.round(node.y)} onChange={e => onUpdate({ y: Number(e.target.value) })} />
        </div>
        <div>
          <div className={labelClass}>Width</div>
          <input className={inputClass} style={{ border: '1px solid var(--border)' }} type="number" value={Math.round(node.width)} onChange={e => onUpdate({ width: Number(e.target.value) })} disabled={node.type === 'artboard'} />
        </div>
        <div>
          <div className={labelClass}>Height</div>
          <input className={inputClass} style={{ border: '1px solid var(--border)' }} type="number" value={Math.round(node.height)} onChange={e => onUpdate({ height: Number(e.target.value) })} disabled={node.type === 'artboard'} />
        </div>
      </div>

      {/* Artboard-specific */}
      {node.type === 'artboard' && (
        <div className="flex flex-col gap-2">
          <div className={labelClass}>Viewport</div>
          <select
            className={inputClass}
            style={{ border: '1px solid var(--border)' }}
            value={(node.data as ArtboardNodeData).viewport}
            onChange={e => {
              const vp = e.target.value as Viewport
              const { width, height } = VIEWPORT_SIZES[vp]
              onUpdateData({ ...(node.data as ArtboardNodeData), viewport: vp })
              onUpdate({ width, height })
            }}
          >
            <option value="desktop">Desktop (1440x900)</option>
            <option value="tablet">Tablet (768x1024)</option>
            <option value="mobile">Mobile (375x812)</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={node.excludeFromExport || false}
              onChange={e => onUpdate({ excludeFromExport: e.target.checked })}
            />
            Exclude from export
          </label>
          {onEditInChat && (
            <button className="text-xs px-3 py-1.5 rounded-md" style={{ background: 'var(--accent)', color: '#fff' }} onClick={onEditInChat}>
              Edit in Chat
            </button>
          )}
        </div>
      )}

      {/* Shape/Widget label and colors */}
      {(node.type === 'shape' || node.type === 'widget') && (
        <div className="flex flex-col gap-2">
          <div>
            <div className={labelClass}>Label</div>
            <input
              className={inputClass}
              style={{ border: '1px solid var(--border)' }}
              value={(node.data as ShapeNodeData | WidgetNodeData).label}
              onChange={e => onUpdateData({ ...node.data, label: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className={labelClass}>Fill</div>
              <input type="color" value={(node.data as any).fillColor || '#000000'} onChange={e => onUpdateData({ ...node.data, fillColor: e.target.value })} />
            </div>
            <div>
              <div className={labelClass}>Stroke</div>
              <input type="color" value={(node.data as any).strokeColor || '#ffffff'} onChange={e => onUpdateData({ ...node.data, strokeColor: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {/* Image alt text */}
      {node.type === 'image' && (
        <div>
          <div className={labelClass}>Alt text</div>
          <input
            className={inputClass}
            style={{ border: '1px solid var(--border)' }}
            value={(node.data as ImageNodeData).alt || ''}
            onChange={e => onUpdateData({ ...node.data, alt: e.target.value })}
          />
        </div>
      )}

      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Actions */}
      <div className="flex flex-col gap-1">
        <button className="text-xs px-3 py-1.5 rounded-md hover:bg-white/10 text-left" onClick={onBringToFront}>Bring to Front</button>
        <button className="text-xs px-3 py-1.5 rounded-md hover:bg-white/10 text-left" onClick={onSendToBack}>Send to Back</button>
        <button className="text-xs px-3 py-1.5 rounded-md hover:bg-white/10 text-left text-red-400" onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}
```

- [ ] Commit: `git add src/components/canvas/InspectorPanel.tsx && git commit -m "feat(canvas): add InspectorPanel for node property editing"`

### Step 9.2 — Wire InspectorPanel into Sidebar

- [ ] Update `src/components/canvas/Sidebar.tsx`:
  - Import `InspectorPanel`
  - Replace the inspector placeholder with the actual component
  - Pass through update/delete/reorder callbacks from canvas page via new Sidebar props

- [ ] Run `npm run dev`, test:
  - Select a shape → Inspector tab shows properties
  - Change label → shape updates
  - Change colors → shape re-renders
  - Delete via inspector → node removed

- [ ] Commit: `git add src/components/canvas/Sidebar.tsx && git commit -m "feat(canvas): wire InspectorPanel into Sidebar inspector tab"`

---

## Task 10: Minimap

**Files:**
- Create: `src/components/canvas/Minimap.tsx`
- Modify: `src/app/canvas/page.tsx`

### Step 10.1 — Create Minimap

- [ ] Create `src/components/canvas/Minimap.tsx`:

```typescript
'use client'

import { useMemo } from 'react'
import type { CanvasNode } from '@/lib/canvas-types'

interface MinimapProps {
  nodes: CanvasNode[]
  viewportX: number
  viewportY: number
  viewportZoom: number
  containerWidth: number
  containerHeight: number
  onNavigate: (x: number, y: number) => void
}

const MINIMAP_W = 180
const MINIMAP_H = 120

export default function Minimap({ nodes, viewportX, viewportY, viewportZoom, containerWidth, containerHeight, onNavigate }: MinimapProps) {
  const { bounds, scale } = useMemo(() => {
    if (nodes.length === 0) return { bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 }, scale: 0.1 }
    const pad = 200
    const minX = Math.min(...nodes.map(n => n.x)) - pad
    const minY = Math.min(...nodes.map(n => n.y)) - pad
    const maxX = Math.max(...nodes.map(n => n.x + n.width)) + pad
    const maxY = Math.max(...nodes.map(n => n.y + n.height)) + pad
    const scaleX = MINIMAP_W / (maxX - minX)
    const scaleY = MINIMAP_H / (maxY - minY)
    return { bounds: { minX, minY, maxX, maxY }, scale: Math.min(scaleX, scaleY) }
  }, [nodes])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = (e.clientX - rect.left) / scale + bounds.minX
    const clickY = (e.clientY - rect.top) / scale + bounds.minY
    onNavigate(clickX, clickY)
  }

  return (
    <div
      className="absolute bottom-3 right-3 z-50 rounded-lg overflow-hidden cursor-crosshair"
      style={{
        width: MINIMAP_W, height: MINIMAP_H,
        background: 'rgba(0,0,0,0.6)',
        border: '1px solid var(--border)',
      }}
      onClick={handleClick}
    >
      {/* Node bounding boxes */}
      {nodes.map(node => (
        <div
          key={node.id}
          className="absolute"
          style={{
            left: (node.x - bounds.minX) * scale,
            top: (node.y - bounds.minY) * scale,
            width: Math.max(node.width * scale, 2),
            height: Math.max(node.height * scale, 2),
            background: node.type === 'artboard' ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.3)',
            borderRadius: 1,
          }}
        />
      ))}

      {/* Viewport indicator */}
      <div
        className="absolute border"
        style={{
          left: (-viewportX / viewportZoom - bounds.minX) * scale,
          top: (-viewportY / viewportZoom - bounds.minY) * scale,
          width: (containerWidth / viewportZoom) * scale,
          height: (containerHeight / viewportZoom) * scale,
          borderColor: 'rgba(255,255,255,0.6)',
          borderWidth: 1,
        }}
      />
    </div>
  )
}
```

- [ ] Commit: `git add src/components/canvas/Minimap.tsx && git commit -m "feat(canvas): add Minimap with bounding-box view and viewport indicator"`

### Step 10.2 — Wire Minimap into canvas page

- [ ] Update `src/app/canvas/page.tsx`:
  - Import `Minimap`
  - Track viewport transform state (`viewportX`, `viewportY`, `viewportZoom`) from `Canvas.onTransformChange`
  - Track container dimensions via ref
  - Render `<Minimap>` as sibling of `<Canvas>` inside the flex-1 container

- [ ] Run `npm run dev`, test:
  - Minimap shows in bottom-right
  - Node bounding boxes visible
  - Viewport rectangle moves with pan
  - Click on minimap navigates canvas

- [ ] Commit: `git add src/app/canvas/page.tsx && git commit -m "feat(canvas): wire Minimap into canvas page"`

---

## Task 11: Image Upload and Drag-and-Drop

**Files:**
- Modify: `src/app/canvas/page.tsx`
- Modify: `src/components/canvas/CanvasToolbar.tsx`

### Step 11.1 — Add drag-and-drop image upload to canvas

- [ ] Update `src/app/canvas/page.tsx`:
  - Add `onDragOver` and `onDrop` handlers to the canvas container
  - On file drop: upload via `POST /api/uploads`, then create an image node at drop position
  - Also wire the toolbar's "Image" button file input to the same upload flow

```typescript
const handleFileDrop = useCallback(async (e: React.DragEvent) => {
  e.preventDefault()
  const file = e.dataTransfer.files[0]
  if (!file || !file.type.startsWith('image/')) return

  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/uploads', { method: 'POST', body: formData })
  const { path } = await res.json()

  const node: CanvasNode = {
    id: crypto.randomUUID(),
    type: 'image',
    x: 200, y: 200, // TODO: convert drop position to canvas coords
    width: 300, height: 200,
    zIndex: 0,
    data: { src: path },
  }
  pushState(addNode(state, node))
}, [state, pushState])
```

- [ ] Test: drag an image file from Finder onto the canvas → image node appears.
- [ ] Commit: `git add src/app/canvas/page.tsx src/components/canvas/CanvasToolbar.tsx && git commit -m "feat(canvas): add image upload via drag-and-drop and toolbar"`

---

## Task 12: Context Menu

**Files:**
- Modify: `src/app/canvas/page.tsx`

### Step 12.1 — Add right-click context menu

- [ ] Add a simple context menu to `src/app/canvas/page.tsx`:
  - State: `contextMenu: { x: number; y: number; nodeId: string } | null`
  - Right-click on a node → show menu at cursor position
  - Menu items: "Bring to Front", "Send to Back", "Delete"
  - Click outside or Escape → close menu
  - Each action calls the corresponding state function and closes menu

- [ ] Test: right-click a shape → menu appears → "Delete" removes it.
- [ ] Commit: `git add src/app/canvas/page.tsx && git commit -m "feat(canvas): add right-click context menu with bring/send/delete"`

---

## Task 13: Final Integration and Tests

**Files:**
- Modify: `src/lib/canvas-state.test.ts`
- Modify: `src/components/Header.tsx`

### Step 13.1 — Update Header for canvas

- [ ] Update `src/components/Header.tsx`:
  - Keep the PinLaunch logo
  - Update any navigation links to point to `/canvas`
  - Remove or simplify elements that don't apply to the canvas workspace

- [ ] Commit: `git add src/components/Header.tsx && git commit -m "feat(canvas): update Header navigation for canvas route"`

### Step 13.2 — Run full test suite

- [ ] Run all tests:

```bash
npm run test
```

Expected: ALL PASS (existing tests should still pass, canvas-state tests pass)

- [ ] Run build:

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] Commit any remaining fixes.

### Step 13.3 — Manual integration test checklist

- [ ] Visit `http://localhost:3000` → redirects to `/canvas`
- [ ] Empty canvas shows welcome message
- [ ] Toolbar: create shapes (rect, circle, rounded-rect, line) → appear with roughjs style
- [ ] Toolbar: create widgets (button, CTA, input, etc.) → appear with recognizable form
- [ ] Toolbar: create document → shows markdown, double-click to edit
- [ ] Drag image from Finder → uploads and appears on canvas
- [ ] Select node → blue border + Inspector tab populates
- [ ] Inspector: change label → shape updates
- [ ] Inspector: change colors → shape re-renders
- [ ] Inspector: delete → node removed
- [ ] Multi-select with Shift+click
- [ ] Delete key removes selected nodes
- [ ] Ctrl+Z undoes, Ctrl+Shift+Z redoes
- [ ] Right-click → context menu → Bring to Front / Send to Back / Delete
- [ ] Pan with scroll/trackpad
- [ ] Zoom with Ctrl+scroll / pinch (10%–400%)
- [ ] Minimap shows node positions, viewport indicator moves
- [ ] Sidebar Setup tab: PinBoard, GitHub, Presets, Generate work
- [ ] Generate a page → artboard appears on canvas with iframe preview
- [ ] Artboard header: drag to move, "Edit" button exists
- [ ] Double-click artboard → interactive mode (can scroll/click inside iframe)
- [ ] Escape → exit interactive mode
- [ ] Sidebar collapses and expands
- [ ] Refresh page → all nodes persist (SQLite auto-save)

---

## Deferred Features (not in this plan)

These features are in the spec but intentionally deferred to keep the initial implementation focused:

- **Lasso selection** (drag on empty area → selection rectangle) — add after core interactions are solid
- **Resize handles** on nodes (corner handles for resizing shapes, images, documents) — add after drag works correctly
- **Aspect ratio lock** (Shift+drag resize) — depends on resize handles
- **Double-click empty area → zoom to fit all** — add after minimap is working
- **Artboard virtualization intersection check** — currently `isVisible={true}` always; add IntersectionObserver when performance requires it
- **Escape to exit artboard interactive mode** — wire a global keydown listener inside ArtboardNode
- **Full app export** — future phase per spec
