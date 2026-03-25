'use client'

import { useCallback, useRef, useState } from 'react'
import type { CanvasNode as CanvasNodeType } from '@/lib/canvas-types'
import ShapeNode from './ShapeNode'
import WidgetNode from './WidgetNode'
import ImageNode from './ImageNode'
import DocumentNode from './DocumentNode'
import ArtboardNode from './ArtboardNode'

interface CanvasNodeProps {
  node: CanvasNodeType
  selected: boolean
  zoom: number
  onSelect: (id: string, shiftKey: boolean) => void
  onMove: (id: string, x: number, y: number) => void
  onResize?: (id: string, width: number, height: number, x: number, y: number) => void
  onUpdateData?: (data: any) => void
  onToggleExclude?: (id: string) => void
  onEditInChat?: (id: string) => void
  onContextMenu?: (id: string, x: number, y: number) => void
  onDragStateChange?: (isDragging: boolean) => void
}

type Corner = 'nw' | 'ne' | 'sw' | 'se'

export default function CanvasNodeComponent({ node, selected, zoom, onSelect, onMove, onResize, onUpdateData, onToggleExclude, onEditInChat, onContextMenu, onDragStateChange }: CanvasNodeProps) {
  // --- Drag state ---
  const dragRef = useRef<{ startX: number; startY: number; nodeX: number; nodeY: number; currentDx: number; currentDy: number; moved: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null)

  // --- Resize state ---
  const resizeRef = useRef<{
    startX: number; startY: number
    nodeX: number; nodeY: number; nodeW: number; nodeH: number
    corner: Corner
    currentDx: number; currentDy: number; currentDw: number; currentDh: number
  } | null>(null)
  const [resizing, setResizing] = useState(false)
  const [resizeOffset, setResizeOffset] = useState<{ dx: number; dy: number; dw: number; dh: number } | null>(null)

  // Stable refs for callbacks
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove
  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize
  const onDragStateChangeRef = useRef(onDragStateChange)
  onDragStateChangeRef.current = onDragStateChange

  // --- Drag handlers ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onSelect(node.id, e.shiftKey)
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      nodeX: node.x, nodeY: node.y,
      currentDx: 0, currentDy: 0,
      moved: false,
    }
    setDragging(true)
    setDragOffset(null)
    onDragStateChangeRef.current?.(true)

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      dragRef.current.moved = true
      const dx = (e.clientX - dragRef.current.startX) / zoom
      const dy = (e.clientY - dragRef.current.startY) / zoom
      dragRef.current.currentDx = dx
      dragRef.current.currentDy = dy
      setDragOffset({ dx, dy })
    }

    const onMouseUp = () => {
      if (dragRef.current?.moved) {
        onMoveRef.current(node.id, dragRef.current.nodeX + dragRef.current.currentDx, dragRef.current.nodeY + dragRef.current.currentDy)
      }
      dragRef.current = null
      setDragging(false)
      setDragOffset(null)
      onDragStateChangeRef.current?.(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [node.id, node.x, node.y, zoom, onSelect])

  // --- Resize handlers ---
  const handleResizeStart = useCallback((e: React.MouseEvent, corner: Corner) => {
    e.stopPropagation()
    e.preventDefault()
    resizeRef.current = {
      startX: e.clientX, startY: e.clientY,
      nodeX: node.x, nodeY: node.y,
      nodeW: node.width, nodeH: node.height,
      corner,
      currentDx: 0, currentDy: 0, currentDw: 0, currentDh: 0,
    }
    setResizing(true)
    setResizeOffset(null)
    onDragStateChangeRef.current?.(true)

    const onMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return
      const rawDx = (e.clientX - resizeRef.current.startX) / zoom
      const rawDy = (e.clientY - resizeRef.current.startY) / zoom
      const c = resizeRef.current.corner
      const r = resizeRef.current

      let dx = 0, dy = 0, dw = 0, dh = 0
      if (c === 'se') { dw = rawDx; dh = rawDy }
      else if (c === 'sw') { dx = rawDx; dw = -rawDx; dh = rawDy }
      else if (c === 'ne') { dw = rawDx; dy = rawDy; dh = -rawDy }
      else if (c === 'nw') { dx = rawDx; dy = rawDy; dw = -rawDx; dh = -rawDy }

      // Shift = lock aspect ratio
      if (e.shiftKey) {
        const aspect = r.nodeW / r.nodeH
        const newW = r.nodeW + dw
        const newH = r.nodeH + dh
        // Use the axis with larger relative change to drive both
        if (Math.abs(dw / r.nodeW) > Math.abs(dh / r.nodeH)) {
          dh = (newW / aspect) - r.nodeH
          if (c === 'ne' || c === 'nw') dy = -(dh)
        } else {
          dw = (newH * aspect) - r.nodeW
          if (c === 'sw' || c === 'nw') dx = -(dw)
        }
      }

      // Alt = resize from center (expand both sides equally)
      if (e.altKey) {
        // Double the delta and shift position by negative half
        const centerDw = dw * 2
        const centerDh = dh * 2
        dx = -(centerDw - dw + (c === 'sw' || c === 'nw' ? dw - dx : 0))
        dy = -(centerDh - dh + (c === 'ne' || c === 'nw' ? dh - dy : 0))
        // Simpler: for any corner, shift position by -dw and -dh, double size delta
        dx = -dw
        dy = -dh
        dw = centerDw
        dh = centerDh
      }

      // Enforce minimum 30px
      const newW = r.nodeW + dw
      const newH = r.nodeH + dh
      if (newW < 30) {
        const clampDw = 30 - r.nodeW
        if (c === 'sw' || c === 'nw') dx = -(clampDw)
        dw = clampDw
      }
      if (newH < 30) {
        const clampDh = 30 - r.nodeH
        if (c === 'ne' || c === 'nw') dy = -(clampDh)
        dh = clampDh
      }

      resizeRef.current.currentDx = dx
      resizeRef.current.currentDy = dy
      resizeRef.current.currentDw = dw
      resizeRef.current.currentDh = dh
      setResizeOffset({ dx, dy, dw, dh })
    }

    const onMouseUp = () => {
      if (resizeRef.current) {
        const r = resizeRef.current
        const finalX = r.nodeX + r.currentDx
        const finalY = r.nodeY + r.currentDy
        const finalW = Math.max(30, r.nodeW + r.currentDw)
        const finalH = Math.max(30, r.nodeH + r.currentDh)
        onResizeRef.current?.(node.id, finalW, finalH, finalX, finalY)
      }
      resizeRef.current = null
      setResizing(false)
      setResizeOffset(null)
      onDragStateChangeRef.current?.(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [node.id, node.x, node.y, node.width, node.height, zoom])

  // --- Visual position/size ---
  const visualX = dragOffset ? node.x + dragOffset.dx : (resizeOffset ? node.x + resizeOffset.dx : node.x)
  const visualY = dragOffset ? node.y + dragOffset.dy : (resizeOffset ? node.y + resizeOffset.dy : node.y)
  const visualW = resizeOffset ? Math.max(30, node.width + resizeOffset.dw) : node.width
  const visualH = resizeOffset ? Math.max(30, node.height + resizeOffset.dh) : node.height

  const isResizable = node.type !== 'artboard'

  const renderContent = () => {
    switch (node.type) {
      case 'shape':
        return <ShapeNode width={visualW} height={visualH} data={node.data as any} selected={selected} onMouseDown={handleMouseDown} />
      case 'widget':
        return <WidgetNode width={visualW} height={visualH} data={node.data as any} selected={selected} onMouseDown={handleMouseDown} />
      case 'image':
        return <ImageNode width={visualW} height={visualH} data={node.data as any} selected={selected} onMouseDown={handleMouseDown} />
      case 'document':
        return <DocumentNode width={visualW} height={visualH} data={node.data as any} selected={selected} onMouseDown={handleMouseDown} onUpdateData={(newData) => onUpdateData?.(newData)} />
      case 'artboard':
        return (
          <ArtboardNode
            width={node.width}
            height={node.height}
            data={node.data as any}
            selected={selected}
            isVisible={true}
            onMouseDown={handleMouseDown}
            onToggleExclude={() => onToggleExclude?.(node.id)}
            onEditInChat={() => onEditInChat?.(node.id)}
          />
        )
      default:
        return null
    }
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onContextMenu?.(node.id, e.clientX, e.clientY)
  }, [node.id, onContextMenu])

  const handleSize = 8
  const handleStyle = (cursor: string): React.CSSProperties => ({
    position: 'absolute',
    width: handleSize,
    height: handleSize,
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    border: '1px solid rgba(255,255,255,0.8)',
    borderRadius: 1,
    cursor,
    zIndex: 10,
  })

  return (
    <div
      className="absolute canvas-node"
      style={{
        left: visualX,
        top: visualY,
        zIndex: node.zIndex,
        cursor: dragging ? 'grabbing' : (resizing ? 'default' : 'grab'),
        outline: selected ? '2px solid rgba(34, 197, 94, 0.7)' : 'none',
        outlineOffset: '4px',
        backgroundColor: selected ? 'rgba(34, 197, 94, 0.06)' : 'transparent',
        borderRadius: '4px',
        padding: selected ? '2px' : '0',
      }}
      onContextMenu={handleContextMenu}
    >
      {renderContent()}

      {selected && isResizable && (
        <>
          <div style={{ ...handleStyle('nw-resize'), top: -handleSize / 2 - 2, left: -handleSize / 2 - 2 }} onMouseDown={(e) => handleResizeStart(e, 'nw')} />
          <div style={{ ...handleStyle('ne-resize'), top: -handleSize / 2 - 2, right: -handleSize / 2 - 2 }} onMouseDown={(e) => handleResizeStart(e, 'ne')} />
          <div style={{ ...handleStyle('sw-resize'), bottom: -handleSize / 2 - 2, left: -handleSize / 2 - 2 }} onMouseDown={(e) => handleResizeStart(e, 'sw')} />
          <div style={{ ...handleStyle('se-resize'), bottom: -handleSize / 2 - 2, right: -handleSize / 2 - 2 }} onMouseDown={(e) => handleResizeStart(e, 'se')} />
        </>
      )}
    </div>
  )
}
