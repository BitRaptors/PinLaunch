'use client'

import { useState } from 'react'
import PinBoard from '@/components/PinBoard'
import GitHubPanel from '@/components/GitHubPanel'
import PresetsPanel from '@/components/PresetsPanel'
import GeneratePanel from '@/components/GeneratePanel'
import InspectorPanel from './InspectorPanel'
import type { CanvasNode } from '@/lib/canvas-types'

type SidebarTab = 'setup' | 'chat' | 'inspector'

interface SidebarProps {
  selectedNode: CanvasNode | null
  provider: string
  onSiteReady: (siteDir: string, sessionId?: string, provider?: string, previewUrl?: string, isVite?: boolean) => void
  onFileChange: () => void
  collapsed: boolean
  onToggleCollapse: () => void
  onUpdateNode?: (updates: Partial<CanvasNode>) => void
  onUpdateNodeData?: (data: any) => void
  onDeleteNode?: () => void
  onBringToFront?: () => void
  onSendToBack?: () => void
  onEditInChat?: () => void
}

export default function Sidebar({ selectedNode, provider, onSiteReady, onFileChange, collapsed, onToggleCollapse, onUpdateNode, onUpdateNodeData, onDeleteNode, onBringToFront, onSendToBack, onEditInChat }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('setup')

  if (collapsed) {
    return (
      <button
        className="absolute left-0 top-1/2 -translate-y-1/2 z-40 px-1.5 py-4 rounded-r-lg"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: 'none' }}
        onClick={onToggleCollapse}
      >
        <span className="text-xs" style={{ writingMode: 'vertical-lr' }}>Sidebar</span>
      </button>
    )
  }

  const tabClass = (tab: SidebarTab) =>
    `px-3 py-2 text-xs font-medium transition-colors ${activeTab === tab ? 'border-b-2' : 'opacity-50 hover:opacity-100'}`

  return (
    <div className="w-[380px] shrink-0 flex flex-col h-full" style={{ background: 'var(--bg)', borderRight: '1px solid var(--border)' }}>
      <div className="flex items-center border-b" style={{ borderColor: 'var(--border)' }}>
        <button className={tabClass('setup')} style={activeTab === 'setup' ? { borderColor: 'var(--accent)' } : {}} onClick={() => setActiveTab('setup')}>Setup</button>
        <button className={tabClass('chat')} style={activeTab === 'chat' ? { borderColor: 'var(--accent)' } : {}} onClick={() => setActiveTab('chat')}>Chat</button>
        <button className={tabClass('inspector')} style={activeTab === 'inspector' ? { borderColor: 'var(--accent)' } : {}} onClick={() => setActiveTab('inspector')}>Inspector</button>
        <div className="flex-1" />
        <button className="px-2 py-1 text-xs opacity-50 hover:opacity-100" onClick={onToggleCollapse}>Hide</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'setup' && (
          <div className="flex flex-col gap-4">
            <PinBoard />
            <GitHubPanel />
            <PresetsPanel />
            <GeneratePanel provider={provider} onSiteReady={onSiteReady} onFileChange={onFileChange} />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="text-sm opacity-50">
            {selectedNode?.type === 'artboard' ? `Editing: ${(selectedNode.data as any).name}` : 'Select an artboard to start chatting'}
          </div>
        )}

        {activeTab === 'inspector' && (
          selectedNode && onUpdateNode && onUpdateNodeData && onDeleteNode && onBringToFront && onSendToBack ? (
            <InspectorPanel
              node={selectedNode}
              onUpdate={onUpdateNode}
              onUpdateData={onUpdateNodeData}
              onDelete={onDeleteNode}
              onBringToFront={onBringToFront}
              onSendToBack={onSendToBack}
              onEditInChat={selectedNode.type === 'artboard' ? onEditInChat : undefined}
            />
          ) : (
            <div className="text-sm opacity-50">Select a node to inspect</div>
          )
        )}
      </div>
    </div>
  )
}
