'use client'

import { useState, useCallback } from 'react'
import type { DocNodeData } from '@/lib/canvas-types'

interface DocumentNodeProps {
  width: number
  height: number
  data: DocNodeData
  selected: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onUpdateData: (data: DocNodeData) => void
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:600;margin:8px 0 4px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:600;margin:8px 0 4px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:700;margin:8px 0 4px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

export default function DocumentNode({ width, height, data, selected, onMouseDown, onUpdateData }: DocumentNodeProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.markdown)

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setEditing(true)
    setDraft(data.markdown)
  }, [data.markdown])

  const handleBlur = useCallback(() => {
    setEditing(false)
    if (draft !== data.markdown) {
      onUpdateData({ ...data, markdown: draft })
    }
  }, [draft, data, onUpdateData])

  return (
    <div
      className="relative cursor-move overflow-auto"
      style={{
        width, height,
        background: 'rgba(var(--surface-rgb, 30, 30, 34), 0.85)',
        borderRadius: 'var(--radius-md)',
        outline: '1px solid var(--border)',
        outlineOffset: '0',
        padding: '12px',
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {data.title && (
        <div className="text-xs font-semibold mb-2 opacity-60 uppercase tracking-wider">{data.title}</div>
      )}
      {editing ? (
        <textarea
          className="w-full h-full bg-transparent text-sm resize-none focus:outline-none"
          style={{ color: 'var(--text)', fontFamily: 'monospace' }}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          autoFocus
        />
      ) : (
        <div
          className="text-sm leading-relaxed"
          style={{ color: 'var(--text)' }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(data.markdown) }}
        />
      )}
    </div>
  )
}
