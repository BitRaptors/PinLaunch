'use client'

import { useState } from 'react'
import type { ImageNodeData } from '@/lib/canvas-types'

interface ImageNodeProps {
  width: number
  height: number
  data: ImageNodeData
  selected: boolean
  onMouseDown: (e: React.MouseEvent) => void
}

export default function ImageNode({ width, height, data, selected, onMouseDown }: ImageNodeProps) {
  const [error, setError] = useState(false)
  const src = data.src.startsWith('http') ? data.src : `/api/uploads/${data.src.split('/').pop() || data.src}`

  return (
    <div
      className="relative cursor-move"
      style={{
        width, height,
      }}
      onMouseDown={onMouseDown}
    >
      {error ? (
        <div
          className="w-full h-full flex items-center justify-center text-sm opacity-50"
          style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}
        >
          Missing image
        </div>
      ) : (
        <img
          src={src}
          alt={data.alt || ''}
          className="w-full h-full object-cover"
          style={{ borderRadius: 'var(--radius-sm)' }}
          onError={() => setError(true)}
          draggable={false}
        />
      )}
    </div>
  )
}
