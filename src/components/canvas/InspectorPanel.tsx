'use client'

import type { CanvasNode, ArtboardNodeData, ImageNodeData, ShapeNodeData, WidgetNodeData, Viewport } from '@/lib/canvas-types'
import { VIEWPORT_SIZES } from '@/lib/canvas-types'

interface InspectorPanelProps {
  node: CanvasNode
  onUpdate: (updates: Partial<CanvasNode>) => void
  onUpdateData: (data: any) => void
  onDelete: () => void
  onBringToFront: () => void
  onSendToBack: () => void
  onEditInChat?: () => void
}

export default function InspectorPanel({ node, onUpdate, onUpdateData, onDelete, onBringToFront, onSendToBack, onEditInChat }: InspectorPanelProps) {
  const labelClass = "text-xs font-medium opacity-60 uppercase tracking-wider mb-1"
  const inputClass = "w-full px-2 py-1.5 text-sm rounded-md bg-transparent"

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className={labelClass}>Type</div>
        <div className="text-sm capitalize">{node.type}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><div className={labelClass}>X</div><input className={inputClass} style={{ border: '1px solid var(--border)' }} type="number" value={Math.round(node.x)} onChange={e => onUpdate({ x: Number(e.target.value) })} /></div>
        <div><div className={labelClass}>Y</div><input className={inputClass} style={{ border: '1px solid var(--border)' }} type="number" value={Math.round(node.y)} onChange={e => onUpdate({ y: Number(e.target.value) })} /></div>
        <div><div className={labelClass}>Width</div><input className={inputClass} style={{ border: '1px solid var(--border)' }} type="number" value={Math.round(node.width)} onChange={e => onUpdate({ width: Number(e.target.value) })} disabled={node.type === 'artboard'} /></div>
        <div><div className={labelClass}>Height</div><input className={inputClass} style={{ border: '1px solid var(--border)' }} type="number" value={Math.round(node.height)} onChange={e => onUpdate({ height: Number(e.target.value) })} disabled={node.type === 'artboard'} /></div>
      </div>
      {node.type === 'artboard' && (
        <div className="flex flex-col gap-2">
          <div className={labelClass}>Viewport</div>
          <select className={inputClass} style={{ border: '1px solid var(--border)' }} value={(node.data as ArtboardNodeData).viewport} onChange={e => { const vp = e.target.value as Viewport; const { width, height } = VIEWPORT_SIZES[vp]; onUpdateData({ ...(node.data as ArtboardNodeData), viewport: vp }); onUpdate({ width, height }) }}>
            <option value="desktop">Desktop (1440x900)</option>
            <option value="tablet">Tablet (768x1024)</option>
            <option value="mobile">Mobile (375x812)</option>
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={node.excludeFromExport || false} onChange={e => onUpdate({ excludeFromExport: e.target.checked })} /> Exclude from export</label>
          {onEditInChat && <button className="text-xs px-3 py-1.5 rounded-md" style={{ background: 'var(--accent)', color: '#fff' }} onClick={onEditInChat}>Edit in Chat</button>}
        </div>
      )}
      {(node.type === 'shape' || node.type === 'widget') && (
        <div className="flex flex-col gap-2">
          <div><div className={labelClass}>Label</div><input className={inputClass} style={{ border: '1px solid var(--border)' }} value={(node.data as ShapeNodeData | WidgetNodeData).label} onChange={e => onUpdateData({ ...node.data, label: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><div className={labelClass}>Fill</div><input type="color" value={(node.data as any).fillColor || '#000000'} onChange={e => onUpdateData({ ...node.data, fillColor: e.target.value })} /></div>
            <div><div className={labelClass}>Stroke</div><input type="color" value={(node.data as any).strokeColor || '#ffffff'} onChange={e => onUpdateData({ ...node.data, strokeColor: e.target.value })} /></div>
          </div>
        </div>
      )}
      {node.type === 'image' && (
        <div><div className={labelClass}>Alt text</div><input className={inputClass} style={{ border: '1px solid var(--border)' }} value={(node.data as ImageNodeData).alt || ''} onChange={e => onUpdateData({ ...node.data, alt: e.target.value })} /></div>
      )}
      <div style={{ height: 1, background: 'var(--border)' }} />
      <div className="flex flex-col gap-1">
        <button className="text-xs px-3 py-1.5 rounded-md hover:bg-white/10 text-left" onClick={onBringToFront}>Bring to Front</button>
        <button className="text-xs px-3 py-1.5 rounded-md hover:bg-white/10 text-left" onClick={onSendToBack}>Send to Back</button>
        <button className="text-xs px-3 py-1.5 rounded-md hover:bg-white/10 text-left text-red-400" onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}
