'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Canvas from '@/components/canvas/Canvas'
import CanvasNodeComponent from '@/components/canvas/CanvasNode'
import CanvasToolbar from '@/components/canvas/CanvasToolbar'
import Minimap from '@/components/canvas/Minimap'
import Sidebar from '@/components/canvas/Sidebar'
import { CanvasState, CanvasNode, createEmptyState, VIEWPORT_SIZES } from '@/lib/canvas-types'
import type { ShapeType, WidgetType } from '@/lib/canvas-types'
import { addNode, removeNode, updateNode, moveNode, bringToFront, sendToBack, createUndoRedoManager } from '@/lib/canvas-state'
import Header from '@/components/Header'

export default function CanvasPage() {
  const [state, setState] = useState<CanvasState>(createEmptyState())
  const [projectId, setProjectId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(1)
  const [viewportX, setViewportX] = useState(0)
  const [viewportY, setViewportY] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [provider, setProvider] = useState('claude')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const [isDraggingNode, setIsDraggingNode] = useState(false)
  const [multiDragOffset, setMultiDragOffset] = useState<{ dx: number; dy: number; sourceId: string } | null>(null)
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const undoMgr = useRef(createUndoRedoManager())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/canvas')
      .then(r => r.json())
      .then(data => {
        setProjectId(data.projectId)
        setState(data.state)
        undoMgr.current.push(data.state)
      })
    // Fetch provider from settings
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => { if (s.ai_provider) setProvider(s.ai_provider) })
      .catch(() => {})
  }, [])

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
        setContextMenu(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, selectedIds, pushState, handleUndo, handleRedo])

  useEffect(() => {
    const handler = () => {
      if (projectId === null) return
      const blob = new Blob([JSON.stringify({ projectId, state })], { type: 'application/json' })
      navigator.sendBeacon('/api/canvas', blob)
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [projectId, state])

  // Toolbar → Sidebar triggers
  const handleAddWebsite = useCallback(() => {
    if (sidebarCollapsed) setSidebarCollapsed(false)
    setExternalPrompt('')
  }, [sidebarCollapsed])

  const handlePromptSubmit = useCallback((text: string) => {
    if (sidebarCollapsed) setSidebarCollapsed(false)
    setExternalPrompt(text)
  }, [sidebarCollapsed])

  // Node creation handlers
  const handleAddShape = useCallback((shapeType: ShapeType, x: number, y: number) => {
    const node: CanvasNode = {
      id: crypto.randomUUID(),
      type: 'shape',
      x, y,
      width: 150,
      height: 100,
      zIndex: state.nodes.length,
      data: { shapeType, label: shapeType },
    }
    pushState(addNode(state, node))
  }, [state, pushState])

  const handleAddWidget = useCallback((widgetType: WidgetType, x: number, y: number) => {
    const node: CanvasNode = {
      id: crypto.randomUUID(),
      type: 'widget',
      x, y,
      width: 120,
      height: 40,
      zIndex: state.nodes.length,
      data: { widgetType, label: widgetType },
    }
    pushState(addNode(state, node))
  }, [state, pushState])

  const handleAddDocument = useCallback(() => {
    const node: CanvasNode = {
      id: crypto.randomUUID(),
      type: 'document',
      x: 200,
      y: 200,
      width: 300,
      height: 200,
      zIndex: state.nodes.length,
      data: { markdown: '# New Document\n\nDouble-click to edit...', title: 'New Document' },
    }
    pushState(addNode(state, node))
  }, [state, pushState])

  const handleAddImage = useCallback(async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/uploads', { method: 'POST', body: formData })
    const { path } = await res.json()
    const node: CanvasNode = {
      id: crypto.randomUUID(),
      type: 'image',
      x: 200,
      y: 200,
      width: 300,
      height: 200,
      zIndex: state.nodes.length,
      data: { src: path, alt: file.name },
    }
    pushState(addNode(state, node))
  }, [state, pushState])

  // Task 11: Image drag-and-drop
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
      x: 200, y: 200,
      width: 300, height: 200,
      zIndex: 0,
      data: { src: path },
    }
    pushState(addNode(state, node))
  }, [state, pushState])

  const handleSiteReady = useCallback((siteDir: string, sessionId?: string, prov?: string) => {
    const viewport = 'desktop' as const
    const { width, height } = VIEWPORT_SIZES[viewport]
    const node: CanvasNode = {
      id: crypto.randomUUID(),
      type: 'artboard',
      x: state.nodes.length * 100,
      y: 100,
      width, height,
      zIndex: 0,
      data: { name: siteDir.replace('site-', ''), siteDir, viewport, provider: (prov || 'gemini') as 'gemini' | 'claude', sessionId },
    }
    pushState(addNode(state, node))
  }, [state, pushState])

  // Derive selectedNode from selectedIds
  const selectedNode = state.nodes.find(n => selectedIds.has(n.id)) ?? null
  const selectedId = selectedNode?.id ?? null

  const handleUpdateNode = useCallback((updates: Partial<CanvasNode>) => {
    if (!selectedId) return
    pushState(updateNode(state, selectedId, updates))
  }, [state, selectedId, pushState])

  const handleUpdateNodeData = useCallback((data: any) => {
    if (!selectedId) return
    pushState(updateNode(state, selectedId, { data }))
  }, [state, selectedId, pushState])

  const handleDeleteNode = useCallback(() => {
    if (!selectedId) return
    pushState(removeNode(state, selectedId))
    setSelectedIds(new Set())
  }, [state, selectedId, pushState])

  const handleBringToFront = useCallback(() => {
    if (!selectedId) return
    pushState(bringToFront(state, selectedId))
  }, [state, selectedId, pushState])

  const handleSendToBack = useCallback(() => {
    if (!selectedId) return
    pushState(sendToBack(state, selectedId))
  }, [state, selectedId, pushState])

  // Task 12: Context menu handlers
  const handleContextMenu = useCallback((nodeId: string, x: number, y: number) => {
    setContextMenu({ x, y, nodeId })
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const containerWidth = containerRef.current?.clientWidth ?? 800
  const containerHeight = containerRef.current?.clientHeight ?? 600

  const handleSelectProject = useCallback(async (project: any) => {
    // Load project as artboard on canvas
    const siteDir = project.site_dir
    const viewport = 'desktop' as const
    const { width, height } = VIEWPORT_SIZES[viewport]
    const node: CanvasNode = {
      id: crypto.randomUUID(),
      type: 'artboard',
      x: state.nodes.length * 200,
      y: 100,
      width, height,
      zIndex: 0,
      data: {
        name: project.name || siteDir.replace('site-', ''),
        siteDir,
        viewport,
        provider: (project.provider || 'claude') as 'gemini' | 'claude',
        sessionId: project.session_id,
      },
    }
    pushState(addNode(state, node))
  }, [state, pushState])

  const handleSettingsChange = useCallback((settings: Record<string, string>) => {
    if (settings.ai_provider) setProvider(settings.ai_provider)
  }, [])

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Header
        onSelectProject={handleSelectProject}
        onNewProject={() => {}}
        onDeleteProject={() => {}}
        onSettingsChange={handleSettingsChange}
      />
      <div
        className="flex flex-1 overflow-hidden"
        onClick={closeContextMenu}
      >
      <Sidebar
        selectedNode={selectedNode}
        provider={provider}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        onArtboardReady={(siteDir, sessionId, prov) => {
          const viewport = 'desktop' as const
          const { width, height } = VIEWPORT_SIZES[viewport]
          const node: CanvasNode = {
            id: crypto.randomUUID(),
            type: 'artboard',
            x: state.nodes.length * 200,
            y: 100,
            width, height,
            zIndex: 0,
            data: {
              name: siteDir.replace('site-', ''),
              siteDir,
              viewport,
              provider: (prov || 'claude') as 'gemini' | 'claude',
              sessionId,
            },
          }
          pushState(addNode(state, node))
        }}
        onUpdateNode={handleUpdateNode}
        onUpdateNodeData={handleUpdateNodeData}
        onDeleteNode={handleDeleteNode}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        onEditInChat={undefined}
        externalPrompt={externalPrompt}
        onExternalPromptConsumed={() => setExternalPrompt(null)}
      />
      <div
        ref={containerRef}
        className="flex-1 relative"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
      >
        <CanvasToolbar
          onAddWebsite={handleAddWebsite}
          onAddImage={handleAddImage}
          onAddDocument={handleAddDocument}
          onAddShape={handleAddShape}
          onAddWidget={handleAddWidget}
          onPromptSubmit={handlePromptSubmit}
        />
        <Canvas
          panningDisabled={isDraggingNode}
          onTransformChange={(x, y, z) => { setViewportX(x); setViewportY(y); setZoom(z) }}
          onLassoUpdate={(rect) => {
            if (!rect) {
              setSelectedIds(new Set())
              return
            }
            const ids = new Set<string>()
            for (const node of state.nodes) {
              if (
                node.x < rect.x + rect.width &&
                node.x + node.width > rect.x &&
                node.y < rect.y + rect.height &&
                node.y + node.height > rect.y
              ) {
                ids.add(node.id)
              }
            }
            setSelectedIds(ids)
          }}
        >
          {state.nodes.length === 0 && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center opacity-50">
              <p className="text-lg mb-2">Start by adding pins and generating your first page in the Setup tab</p>
              <p className="text-sm">← Use the sidebar to get started</p>
            </div>
          )}
          {state.nodes.map(node => (
            <CanvasNodeComponent
              key={node.id}
              node={node}
              selected={selectedIds.has(node.id)}
              zoom={zoom}
              externalDragOffset={
                multiDragOffset && multiDragOffset.sourceId !== node.id && selectedIds.has(node.id)
                  ? { dx: multiDragOffset.dx, dy: multiDragOffset.dy }
                  : null
              }
              onSelect={(id, shift) => {
                setSelectedIds(prev => {
                  if (shift) {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  }
                  if (prev.has(id)) return prev
                  return new Set([id])
                })
              }}
              onMove={(id, deltaX, deltaY) => {
                // Move all selected nodes by the same delta
                if (selectedIds.has(id) && selectedIds.size > 1) {
                  const movedNode = state.nodes.find(n => n.id === id)
                  if (!movedNode) return
                  const dx = deltaX - movedNode.x
                  const dy = deltaY - movedNode.y
                  let s = state
                  for (const selectedId of selectedIds) {
                    const n = s.nodes.find(nd => nd.id === selectedId)
                    if (n) s = moveNode(s, selectedId, n.x + dx, n.y + dy)
                  }
                  pushState(s)
                } else {
                  pushState(moveNode(state, id, deltaX, deltaY))
                }
                setMultiDragOffset(null)
              }}
              onDragOffsetChange={(dx, dy) => {
                if (selectedIds.size > 1 && selectedIds.has(node.id)) {
                  if (dx === 0 && dy === 0) {
                    setMultiDragOffset(null)
                  } else {
                    setMultiDragOffset({ dx, dy, sourceId: node.id })
                  }
                }
              }}
              onResize={(id, width, height, x, y) => {
                pushState(updateNode(state, id, { width, height, x, y }))
              }}
              onUpdateData={(data) => {
                pushState(updateNode(state, node.id, { data }))
              }}
              onToggleExclude={(id) => {
                const n = state.nodes.find(x => x.id === id)
                if (n) pushState(updateNode(state, id, { excludeFromExport: !n.excludeFromExport }))
              }}
              onContextMenu={handleContextMenu}
              onDragStateChange={setIsDraggingNode}
            />
          ))}
        </Canvas>
        <Minimap
          nodes={state.nodes}
          viewportX={viewportX}
          viewportY={viewportY}
          viewportZoom={zoom}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
          onNavigate={(x, y) => { setViewportX(-x * zoom); setViewportY(-y * zoom) }}
        />
        {contextMenu && (
          <div
            className="fixed z-[100] rounded-lg shadow-xl overflow-hidden"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              minWidth: 160,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--surface-hover)] transition-colors"
              onClick={() => {
                pushState(bringToFront(state, contextMenu.nodeId))
                closeContextMenu()
              }}
            >
              Bring to Front
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--surface-hover)] transition-colors"
              onClick={() => {
                pushState(sendToBack(state, contextMenu.nodeId))
                closeContextMenu()
              }}
            >
              Send to Back
            </button>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <button
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[var(--surface-hover)] transition-colors"
              onClick={() => {
                pushState(removeNode(state, contextMenu.nodeId))
                setSelectedIds(prev => { const next = new Set(prev); next.delete(contextMenu.nodeId); return next })
                closeContextMenu()
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
