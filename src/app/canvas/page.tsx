'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Canvas from '@/components/canvas/Canvas'
import CanvasNodeComponent from '@/components/canvas/CanvasNode'
import CanvasToolbar from '@/components/canvas/CanvasToolbar'
import Sidebar from '@/components/canvas/Sidebar'
import { CanvasState, CanvasNode, createEmptyState, VIEWPORT_SIZES } from '@/lib/canvas-types'
import type { ShapeType, WidgetType } from '@/lib/canvas-types'
import { addNode, removeNode, updateNode, moveNode, bringToFront, sendToBack, createUndoRedoManager } from '@/lib/canvas-state'

export default function CanvasPage() {
  const [state, setState] = useState<CanvasState>(createEmptyState())
  const [projectId, setProjectId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(1)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [provider, setProvider] = useState('gemini')
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
    const { url } = await res.json()
    const node: CanvasNode = {
      id: crypto.randomUUID(),
      type: 'image',
      x: 200,
      y: 200,
      width: 300,
      height: 200,
      zIndex: state.nodes.length,
      data: { src: url, alt: file.name },
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

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Sidebar
        selectedNode={selectedNode}
        provider={provider}
        onSiteReady={handleSiteReady}
        onFileChange={() => {}}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        onUpdateNode={handleUpdateNode}
        onUpdateNodeData={handleUpdateNodeData}
        onDeleteNode={handleDeleteNode}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        onEditInChat={undefined}
      />
      <div className="flex-1 relative">
        <CanvasToolbar
          onAddShape={handleAddShape}
          onAddWidget={handleAddWidget}
          onAddDocument={handleAddDocument}
          onAddImage={handleAddImage}
        />
        <Canvas onTransformChange={(_x, _y, z) => setZoom(z)}>
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
              onUpdateData={(data) => {
                pushState(updateNode(state, node.id, { data }))
              }}
              onToggleExclude={(id) => {
                const n = state.nodes.find(x => x.id === id)
                if (n) pushState(updateNode(state, id, { excludeFromExport: !n.excludeFromExport }))
              }}
            />
          ))}
        </Canvas>
      </div>
    </div>
  )
}
