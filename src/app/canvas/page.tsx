'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Canvas from '@/components/canvas/Canvas'
import CanvasNodeComponent from '@/components/canvas/CanvasNode'
import { CanvasState, CanvasNode, createEmptyState } from '@/lib/canvas-types'
import { addNode, removeNode, updateNode, moveNode, bringToFront, sendToBack, createUndoRedoManager } from '@/lib/canvas-state'

export default function CanvasPage() {
  const [state, setState] = useState<CanvasState>(createEmptyState())
  const [projectId, setProjectId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(1)
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

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-[380px] shrink-0 border-r" style={{ borderColor: 'var(--border)' }}>
        <div className="p-4 text-sm opacity-50">Sidebar — coming soon</div>
      </div>
      <div className="flex-1 relative">
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
            />
          ))}
        </Canvas>
      </div>
    </div>
  )
}
