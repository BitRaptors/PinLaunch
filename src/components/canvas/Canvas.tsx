'use client'

import { useRef, useCallback, useState, useEffect, ReactNode } from 'react'
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'

interface CanvasProps {
  children: ReactNode
  panningDisabled?: boolean
  onTransformChange?: (x: number, y: number, zoom: number) => void
  onLassoUpdate?: (rect: { x: number; y: number; width: number; height: number } | null) => void
}

export default function Canvas({ children, panningDisabled, onTransformChange, onLassoUpdate }: CanvasProps) {
  const transformRef = useRef<ReactZoomPanPinchRef>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [lasso, setLasso] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const lassoRef = useRef<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const transformRef2 = useRef(transform)
  transformRef2.current = transform
  const onLassoUpdateRef = useRef(onLassoUpdate)
  onLassoUpdateRef.current = onLassoUpdate

  const handleTransform = useCallback((_: unknown, state: { positionX: number; positionY: number; scale: number }) => {
    setTransform({ x: state.positionX, y: state.positionY, scale: state.scale })
    onTransformChange?.(state.positionX, state.positionY, state.scale)
  }, [onTransformChange])

  const gridSize = 24 * transform.scale
  const gridOffsetX = transform.x % gridSize
  const gridOffsetY = transform.y % gridSize

  // Convert screen lasso coords to world rect
  const screenToWorldRect = useCallback((l: { startX: number; startY: number; currentX: number; currentY: number }) => {
    const containerRect = wrapperRef.current?.getBoundingClientRect()
    if (!containerRect) return null
    const t = transformRef2.current
    const x1 = (Math.min(l.startX, l.currentX) - containerRect.left - t.x) / t.scale
    const y1 = (Math.min(l.startY, l.currentY) - containerRect.top - t.y) / t.scale
    const x2 = (Math.max(l.startX, l.currentX) - containerRect.left - t.x) / t.scale
    const y2 = (Math.max(l.startY, l.currentY) - containerRect.top - t.y) / t.scale
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
  }, [])

  // Cancel lasso (called on Escape)
  const cancelLasso = useCallback(() => {
    if (cleanupRef.current) cleanupRef.current()
    lassoRef.current = null
    setLasso(null)
    onLassoUpdateRef.current?.(null)
  }, [])

  // Lasso selection: mousedown on empty canvas area
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('.canvas-node')) return

    const screenX = e.clientX
    const screenY = e.clientY

    lassoRef.current = { startX: screenX, startY: screenY, currentX: screenX, currentY: screenY }
    setLasso({ startX: screenX, startY: screenY, currentX: screenX, currentY: screenY })

    const onMouseMove = (e: MouseEvent) => {
      if (!lassoRef.current) return
      lassoRef.current.currentX = e.clientX
      lassoRef.current.currentY = e.clientY
      setLasso({ ...lassoRef.current })

      // Live update selection
      const worldRect = screenToWorldRect(lassoRef.current)
      if (worldRect && (worldRect.width > 3 || worldRect.height > 3)) {
        onLassoUpdateRef.current?.(worldRect)
      } else {
        onLassoUpdateRef.current?.(null)
      }
    }

    const onMouseUp = () => {
      // If no meaningful drag happened (just a click), deselect all
      if (lassoRef.current) {
        const dx = Math.abs(lassoRef.current.currentX - lassoRef.current.startX)
        const dy = Math.abs(lassoRef.current.currentY - lassoRef.current.startY)
        if (dx < 3 && dy < 3) {
          onLassoUpdateRef.current?.(null)
        }
      }
      lassoRef.current = null
      setLasso(null)
      cleanup()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        lassoRef.current = null
        setLasso(null)
        onLassoUpdateRef.current?.(null)
        cleanup()
      }
    }

    const cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('keydown', onKeyDown)
      cleanupRef.current = null
    }

    cleanupRef.current = cleanup
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('keydown', onKeyDown)
  }, [screenToWorldRect])

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
        // Pinch zoom gesture
        const zoomFactor = Math.exp(-e.deltaY * 0.01)
        const newScale = Math.min(4, Math.max(0.1, ts.scale * zoomFactor))
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
