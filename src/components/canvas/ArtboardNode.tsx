'use client'

import { useState, useCallback, useMemo } from 'react'
import type { ArtboardNodeData } from '@/lib/canvas-types'

interface ArtboardNodeProps {
  width: number
  height: number
  data: ArtboardNodeData
  selected: boolean
  isVisible: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onToggleExclude: () => void
  onEditInChat: () => void
}

export default function ArtboardNode({ width, height, data, selected, isVisible, onMouseDown, onToggleExclude, onEditInChat }: ArtboardNodeProps) {
  const [interactive, setInteractive] = useState(false)

  const previewUrl = useMemo(
    () => `/api/preview/${data.siteDir}/?t=${Date.now()}`,
    [data.siteDir]
  )

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setInteractive(true)
  }, [])

  const handleExitInteractive = useCallback(() => {
    setInteractive(false)
  }, [])

  return (
    <div
      className="relative"
      style={{
        width, height: height + 36,
      }}
    >
      <div
        className="flex items-center gap-2 px-3 cursor-move"
        style={{
          height: 36,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
          borderBottom: '1px solid var(--border)',
          fontSize: '12px',
        }}
        onMouseDown={onMouseDown}
      >
        <span className="font-medium truncate flex-1" style={{ color: 'var(--text)' }}>{data.name}</span>
        <span className="opacity-50 text-xs">{data.viewport}</span>
        <button
          className="opacity-50 hover:opacity-100 text-xs px-1"
          onClick={(e) => { e.stopPropagation(); onToggleExclude() }}
          title="Toggle export"
        >
          &#x2713;
        </button>
        <button
          className="opacity-50 hover:opacity-100 text-xs px-1"
          onClick={(e) => { e.stopPropagation(); onEditInChat() }}
          title="Edit in chat"
        >
          Edit
        </button>
      </div>

      <div
        className="relative overflow-hidden"
        style={{
          width, height,
          background: '#fff',
          borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
        }}
        onDoubleClick={handleDoubleClick}
      >
        {isVisible ? (
          <>
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              style={{ pointerEvents: interactive ? 'auto' : 'none' }}
              title={data.name}
            />
            {!interactive && (
              <div className="absolute inset-0 cursor-move" onMouseDown={onMouseDown} />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--surface)' }}>
            {data.thumbnailUrl ? (
              <img src={data.thumbnailUrl} alt={data.name} className="w-full h-full object-cover object-top" />
            ) : (
              <span className="text-sm opacity-50">{data.name}</span>
            )}
          </div>
        )}
      </div>

      {interactive && (
        <button
          className="absolute -top-8 right-0 text-xs px-2 py-1 rounded"
          style={{ background: '#3b82f6', color: '#fff' }}
          onClick={handleExitInteractive}
        >
          Exit interactive mode (Esc)
        </button>
      )}
    </div>
  )
}
