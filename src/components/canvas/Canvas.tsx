'use client'

import { useRef, useCallback, useState, useEffect, ReactNode } from 'react'
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'

interface CanvasProps {
  children: ReactNode
  panningDisabled?: boolean
  onTransformChange?: (x: number, y: number, zoom: number) => void
  onLassoSelect?: (rect: { x: number; y: number; width: number; height: number }) => void
}

export default function Canvas({ children, panningDisabled, onTransformChange, onLassoSelect }: CanvasProps) {
  const transformRef = useRef<ReactZoomPanPinchRef>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [lasso, setLasso] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const lassoRef = useRef<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const handleTransform = useCallback((_: unknown, state: { positionX: number; positionY: number; scale: number }) => {
    setTransform({ x: state.positionX, y: state.positionY, scale: state.scale })
    onTransformChange?.(state.positionX, state.positionY, state.scale)
  }, [onTransformChange])

  const gridSize = 24 * transform.scale
  const gridOffsetX = transform.x % gridSize
  const gridOffsetY = transform.y % gridSize

  // Lasso selection: mousedown on empty canvas area starts the lasso
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start lasso on left click directly on the canvas content area
    if (e.button !== 0) return
    // Check if the click target is the large content div (empty area)
    const target = e.target as HTMLElement
    if (target.closest('.canvas-node')) return

    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return

    const screenX = e.clientX
    const screenY = e.clientY

    lassoRef.current = { startX: screenX, startY: screenY, currentX: screenX, currentY: screenY }
    setLasso({ startX: screenX, startY: screenY, currentX: screenX, currentY: screenY })

    const handleMouseMove = (e: MouseEvent) => {
      if (!lassoRef.current) return
      lassoRef.current.currentX = e.clientX
      lassoRef.current.currentY = e.clientY
      setLasso({ ...lassoRef.current })
    }

    const handleMouseUp = () => {
      if (lassoRef.current && onLassoSelect) {
        const l = lassoRef.current
        const containerRect = wrapperRef.current?.getBoundingClientRect()
        if (containerRect) {
          // Convert screen coords to world coords
          const x1 = (Math.min(l.startX, l.currentX) - containerRect.left - transform.x) / transform.scale
          const y1 = (Math.min(l.startY, l.currentY) - containerRect.top - transform.y) / transform.scale
          const x2 = (Math.max(l.startX, l.currentX) - containerRect.left - transform.x) / transform.scale
          const y2 = (Math.max(l.startY, l.currentY) - containerRect.top - transform.y) / transform.scale
          const width = x2 - x1
          const height = y2 - y1
          if (width > 5 || height > 5) {
            onLassoSelect({ x: x1, y: y1, width, height })
          }
        }
      }
      lassoRef.current = null
      setLasso(null)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [transform, onLassoSelect])

  // Custom wheel handler: two-finger scroll → pan, pinch (ctrlKey) → zoom
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const api = transformRef.current
      if (!api) return

      const ts = api.instance?.transformState
      if (!ts) return

      if (e.ctrlKey || e.metaKey) {
        // Pinch zoom gesture (trackpad pinch sends ctrlKey + deltaY)
        const zoomFactor = Math.exp(-e.deltaY * 0.01)
        const newScale = Math.min(4, Math.max(0.1, ts.scale * zoomFactor))

        // Zoom toward cursor position
        const rect = el.getBoundingClientRect()
        const cursorX = e.clientX - rect.left
        const cursorY = e.clientY - rect.top
        const ratio = newScale / ts.scale
        const newX = cursorX - (cursorX - ts.positionX) * ratio
        const newY = cursorY - (cursorY - ts.positionY) * ratio

        api.setTransform(newX, newY, newScale, 0)
      } else {
        // Two-finger scroll → pan
        const newX = ts.positionX - e.deltaX
        const newY = ts.positionY - e.deltaY
        api.setTransform(newX, newY, ts.scale, 0)
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // Compute lasso rectangle in screen space for the overlay
  const lassoRect = lasso ? {
    left: Math.min(lasso.startX, lasso.currentX),
    top: Math.min(lasso.startY, lasso.currentY),
    width: Math.abs(lasso.currentX - lasso.startX),
    height: Math.abs(lasso.currentY - lasso.startY),
  } : null

  return (
    <div ref={wrapperRef} className="relative w-full h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
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
        panning={{ velocityDisabled: true, excluded: ['canvas-node'], disabled: panningDisabled || !!lasso }}
        wheel={{ disabled: true }}
        pinch={{ disabled: false }}
        onTransformed={handleTransform}
        doubleClick={{ disabled: true }}
      >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: '100%', height: '100%' }}
        >
          <div
            className="relative"
            style={{ width: '10000px', height: '10000px' }}
            onMouseDown={handleMouseDown}
          >
            {children}
          </div>
        </TransformComponent>
      </TransformWrapper>

      {/* Lasso selection rectangle overlay */}
      {lassoRect && lassoRect.width > 2 && lassoRect.height > 2 && (
        <div
          className="pointer-events-none"
          style={{
            position: 'fixed',
            left: lassoRect.left,
            top: lassoRect.top,
            width: lassoRect.width,
            height: lassoRect.height,
            backgroundColor: 'rgba(34, 197, 94, 0.12)',
            border: '1.5px solid rgba(34, 197, 94, 0.5)',
            borderRadius: '2px',
            zIndex: 9999,
          }}
        />
      )}
    </div>
  )
}
