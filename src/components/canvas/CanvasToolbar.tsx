'use client'

import { useState, useRef } from 'react'
import type { ShapeType, WidgetType } from '@/lib/canvas-types'

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
      <div className="relative">
        <button className={btnClass} onClick={() => { setShowShapes(!showShapes); setShowWidgets(false) }}>Shapes</button>
        {showShapes && (
          <div className={dropdownClass} style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {SHAPES.map(s => (
              <button key={s.type} className={btnClass + ' text-left'} onClick={() => { onAddShape(s.type, 200, 200); setShowShapes(false) }}>{s.label}</button>
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <button className={btnClass} onClick={() => { setShowWidgets(!showWidgets); setShowShapes(false) }}>Widgets</button>
        {showWidgets && (
          <div className={dropdownClass} style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {WIDGETS.map(w => (
              <button key={w.type} className={btnClass + ' text-left'} onClick={() => { onAddWidget(w.type, 200, 200); setShowWidgets(false) }}>{w.label}</button>
            ))}
          </div>
        )}
      </div>
      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
      <button className={btnClass} onClick={() => fileInputRef.current?.click()}>Image</button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onAddImage(e.target.files[0]); e.target.value = '' }} />
      <button className={btnClass} onClick={onAddDocument}>Doc</button>
    </div>
  )
}
