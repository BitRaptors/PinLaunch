export type NodeType = 'artboard' | 'image' | 'document' | 'shape' | 'widget'
export type ShapeType = 'rectangle' | 'circle' | 'rounded-rect' | 'line'
export type WidgetType = 'button' | 'cta' | 'input' | 'dropdown' | 'navbar' | 'card' | 'hero' | 'footer' | 'checkbox' | 'toggle'
export type Viewport = 'desktop' | 'tablet' | 'mobile'

export const VIEWPORT_SIZES: Record<Viewport, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
}

export type ArtboardNodeData = {
  name: string
  siteDir: string
  viewport: Viewport
  provider: 'gemini' | 'claude'
  sessionId?: string
  thumbnailUrl?: string
}

export type ImageNodeData = {
  src: string
  alt?: string
}

export type DocNodeData = {
  markdown: string
  title?: string
}

export type ShapeNodeData = {
  shapeType: ShapeType
  label: string
  fillColor?: string
  strokeColor?: string
}

export type WidgetNodeData = {
  widgetType: WidgetType
  label: string
  fillColor?: string
  strokeColor?: string
}

export type CanvasNode = {
  id: string
  type: NodeType
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  excludeFromExport?: boolean
  data: ArtboardNodeData | ImageNodeData | DocNodeData | ShapeNodeData | WidgetNodeData
}

export type CanvasState = {
  nodes: CanvasNode[]
  viewport: { x: number; y: number; zoom: number }
}

export function createEmptyState(): CanvasState {
  return { nodes: [], viewport: { x: 0, y: 0, zoom: 1 } }
}
