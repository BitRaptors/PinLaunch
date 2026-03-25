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
  onUpdateData?: (data: any) => void
  onToggleExclude?: (id: string) => void
  onEditInChat?: (id: string) => void
  onContextMenu?: (id: string, x: number, y: number) => void
  onDragStateChange?: (isDragging: boolean) => void
}

export default function CanvasNodeComponent({ node, selected, zoom, onSelect, onMove, onUpdateData, onToggleExclude, onEditInChat, onContextMenu, onDragStateChange }: CanvasNodeProps) {
  const dragRef = useRef<{ startX: number; startY: number; nodeX: number; nodeY: number; currentDx: number; currentDy: number; moved: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove
  const onDragStateChangeRef = useRef(onDragStateChange)
  onDragStateChangeRef.current = onDragStateChange

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

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      dragRef.current.moved = true
      const dx = (e.clientX - dragRef.current.startX) / zoom
      const dy = (e.clientY - dragRef.current.startY) / zoom
      dragRef.current.currentDx = dx
      dragRef.current.currentDy = dy
      setDragOffset({ dx, dy })
    }

    const handleMouseUp = () => {
      if (dragRef.current?.moved) {
        const finalX = dragRef.current.nodeX + dragRef.current.currentDx
        const finalY = dragRef.current.nodeY + dragRef.current.currentDy
        onMoveRef.current(node.id, finalX, finalY)
      }
      dragRef.current = null
      setDragging(false)
      setDragOffset(null)
      onDragStateChangeRef.current?.(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [node.id, node.x, node.y, zoom, onSelect])

  // During drag, apply offset visually via CSS transform instead of updating state
  const visualX = dragOffset ? node.x + dragOffset.dx : node.x
  const visualY = dragOffset ? node.y + dragOffset.dy : node.y

  const renderContent = () => {
    switch (node.type) {
      case 'shape':
        return <ShapeNode width={node.width} height={node.height} data={node.data as any} selected={selected} onMouseDown={handleMouseDown} />
      case 'widget':
        return <WidgetNode width={node.width} height={node.height} data={node.data as any} selected={selected} onMouseDown={handleMouseDown} />
      case 'image':
        return <ImageNode width={node.width} height={node.height} data={node.data as any} selected={selected} onMouseDown={handleMouseDown} />
      case 'document':
        return <DocumentNode width={node.width} height={node.height} data={node.data as any} selected={selected} onMouseDown={handleMouseDown} onUpdateData={(newData) => onUpdateData?.(newData)} />
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

  return (
    <div
      className="absolute canvas-node"
      style={{
        left: visualX,
        top: visualY,
        zIndex: node.zIndex,
        cursor: dragging ? 'grabbing' : 'grab',
      }}
      onContextMenu={handleContextMenu}
    >
      {renderContent()}
    </div>
  )
}
