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
      style={{ width: MINIMAP_W, height: MINIMAP_H, background: 'rgba(0,0,0,0.6)', border: '1px solid var(--border)' }}
      onClick={handleClick}
    >
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
