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
