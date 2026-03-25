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
