'use client'

import { useRef, useCallback, useState, ReactNode } from 'react'
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'

interface CanvasProps {
  children: ReactNode
  onTransformChange?: (x: number, y: number, zoom: number) => void
}

export default function Canvas({ children, onTransformChange }: CanvasProps) {
  const transformRef = useRef<ReactZoomPanPinchRef>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })

  const handleTransform = useCallback((_: unknown, state: { positionX: number; positionY: number; scale: number }) => {
    setTransform({ x: state.positionX, y: state.positionY, scale: state.scale })
    onTransformChange?.(state.positionX, state.positionY, state.scale)
  }, [onTransformChange])

  const gridSize = 24 * transform.scale
  const gridOffsetX = transform.x % gridSize
  const gridOffsetY = transform.y % gridSize

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
        }}
      />
      <TransformWrapper
        ref={transformRef}
        minScale={0.1}
        maxScale={4}
        initialScale={1}
        initialPositionX={0}
        initialPositionY={0}
        limitToBounds={false}
        panning={{ velocityDisabled: true, excluded: ['canvas-node'] }}
        onTransformed={handleTransform}
        doubleClick={{ disabled: true }}
      >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: '100%', height: '100%' }}
        >
          <div className="relative" style={{ width: '10000px', height: '10000px' }}>
            {children}
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}
