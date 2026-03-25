'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { ShapeType, WidgetType } from '@/lib/canvas-types'

interface CanvasToolbarProps {
  onAddWebsite: () => void
  onAddImage: (file: File) => void
  onAddDocument: () => void
  onAddShape: (shapeType: ShapeType, x: number, y: number) => void
  onAddWidget: (widgetType: WidgetType, x: number, y: number) => void
  onPromptSubmit: (text: string) => void
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
  { type: 'checkbox', label: 'Check' },
  { type: 'toggle', label: 'Toggle' },
]

// Inline SVG icons (24x24 viewBox, stroke-based)
const WebsiteIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
)

const ImageIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
)

const DocumentIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)

const WireframeIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)

const SparklesIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
  </svg>
)

function ToolButton({ icon, tooltip, onClick, active }: {
  icon: React.ReactNode
  tooltip: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      className="p-2.5 rounded-xl transition-colors relative group"
      style={{
        background: active ? 'var(--surface-active, rgba(255,255,255,0.1))' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-secondary, #a1a1aa)',
      }}
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = active ? 'var(--surface-active, rgba(255,255,255,0.1))' : 'rgba(255,255,255,0.06)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = active ? 'var(--surface-active, rgba(255,255,255,0.1))' : 'transparent')}
    >
      {icon}
      <span
        className="absolute -top-9 left-1/2 -translate-x-1/2 text-[11px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
      >
        {tooltip}
      </span>
    </button>
  )
}

export default function CanvasToolbar({ onAddWebsite, onAddImage, onAddDocument, onAddShape, onAddWidget, onPromptSubmit }: CanvasToolbarProps) {
  const [wireframeOpen, setWireframeOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptText, setPromptText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const toggleWireframe = useCallback(() => {
    setWireframeOpen(prev => !prev)
    setPromptOpen(false)
  }, [])

  const togglePrompt = useCallback(() => {
    setPromptOpen(prev => !prev)
    setWireframeOpen(false)
  }, [])

  // Click outside to close
  useEffect(() => {
    if (!wireframeOpen && !promptOpen) return
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setWireframeOpen(false)
        setPromptOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [wireframeOpen, promptOpen])

  const handlePromptSubmit = useCallback(() => {
    if (promptText.trim()) {
      onPromptSubmit(promptText.trim())
      setPromptText('')
      setPromptOpen(false)
    }
  }, [promptText, onPromptSubmit])

  const wireframeBtnClass = "px-2 py-1.5 text-[11px] rounded-lg hover:bg-white/10 transition-colors text-center"

  return (
    <div
      ref={toolbarRef}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2"
    >
      {/* Prompt input panel */}
      {promptOpen && (
        <div
          className="rounded-2xl p-3 shadow-2xl w-[380px]"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text)' }}
              placeholder="Describe what you want to build..."
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && promptText.trim()) { e.preventDefault(); handlePromptSubmit() }
                if (e.key === 'Escape') { e.stopPropagation(); setPromptOpen(false) }
              }}
            />
            <button
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white shrink-0"
              style={{ background: promptText.trim() ? 'var(--accent)' : 'var(--surface-active, #333)' }}
              onClick={handlePromptSubmit}
              disabled={!promptText.trim()}
            >
              Generate
            </button>
          </div>
        </div>
      )}

      {/* Wireframe submenu */}
      {wireframeOpen && (
        <div
          className="rounded-2xl p-3 shadow-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="text-[10px] uppercase tracking-wider opacity-40 px-1 pb-1.5">Shapes</div>
          <div className="flex gap-1 mb-2">
            {SHAPES.map(s => (
              <button
                key={s.type}
                className={wireframeBtnClass}
                onClick={() => { onAddShape(s.type, 200, 200); setWireframeOpen(false) }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="mb-2" style={{ height: 1, background: 'var(--border)' }} />
          <div className="text-[10px] uppercase tracking-wider opacity-40 px-1 pb-1.5">Widgets</div>
          <div className="grid grid-cols-5 gap-1">
            {WIDGETS.map(w => (
              <button
                key={w.type}
                className={wireframeBtnClass}
                onClick={() => { onAddWidget(w.type, 200, 200); setWireframeOpen(false) }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main pill toolbar */}
      <div
        className="flex items-center gap-0.5 px-2 py-1 rounded-full shadow-2xl"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <ToolButton icon={WebsiteIcon} tooltip="Website" onClick={onAddWebsite} />
        <ToolButton icon={ImageIcon} tooltip="Image" onClick={() => fileInputRef.current?.click()} />
        <ToolButton icon={DocumentIcon} tooltip="Document" onClick={onAddDocument} />
        <ToolButton icon={WireframeIcon} tooltip="Wireframe" onClick={toggleWireframe} active={wireframeOpen} />

        <div className="mx-1" style={{ width: 1, height: 20, background: 'var(--border)' }} />

        <ToolButton icon={SparklesIcon} tooltip="Prompt" onClick={togglePrompt} active={promptOpen} />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) onAddImage(e.target.files[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
