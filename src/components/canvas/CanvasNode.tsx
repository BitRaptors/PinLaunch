'use client'

import { useCallback, useRef, useState } from 'react'
import type { CanvasNode as CanvasNodeType } from '@/lib/canvas-types'
import ShapeNode from './ShapeNode'
import WidgetNode from './WidgetNode'

interface CanvasNodeProps {
  node: CanvasNodeType
  selected: boolean
  zoom: number
  onSelect: (id: string, shiftKey: boolean) => void
  onMove: (id: string, x: number, y: number) => void
  onUpdateData?: (data: any) => void
  onToggleExclude?: (id: string) => void
  onEditInChat?: (id: string) => void
}

export default function CanvasNodeComponent({ node, selected, zoom, onSelect, onMove, onUpdateData, onToggleExclude, onEditInChat }: CanvasNodeProps) {
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
  }, [node.id, node.x, node.y, zoom, onSelect, onMove])

  const renderContent = () => {
    switch (node.type) {
      case 'shape':
        return <ShapeNode width={node.width} height={node.height} data={node.data as any} selected={selected} onMouseDown={handleMouseDown} />
      case 'widget':
        return <WidgetNode width={node.width} height={node.height} data={node.data as any} selected={selected} onMouseDown={handleMouseDown} />
      case 'image':
      case 'document':
      case 'artboard':
        // Placeholder — will be replaced in Tasks 5-6
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
