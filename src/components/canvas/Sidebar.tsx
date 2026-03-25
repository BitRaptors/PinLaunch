'use client'

import { useState, useCallback, useEffect } from 'react'
import PinBoard from '@/components/PinBoard'
import GitHubPanel from '@/components/GitHubPanel'
import PresetsPanel from '@/components/PresetsPanel'
import GeneratePanel from '@/components/GeneratePanel'
import CreativeDirectorTerminal from '@/components/CreativeDirectorTerminal'
import BriefEditor from '@/components/BriefEditor'
import ClaudeTerminal from '@/components/ClaudeTerminal'
import InspectorPanel from './InspectorPanel'
import type { CanvasNode } from '@/lib/canvas-types'
import type { Brief } from '@/lib/brief'

type SidebarTab = 'setup' | 'chat' | 'inspector'
type Phase = 'idle' | 'preparing' | 'brief' | 'building'

interface SidebarProps {
  selectedNode: CanvasNode | null
  provider: string
  collapsed: boolean
  onToggleCollapse: () => void
  onArtboardReady: (siteDir: string, sessionId?: string, provider?: string) => void
  onUpdateNode?: (updates: Partial<CanvasNode>) => void
  onUpdateNodeData?: (data: any) => void
  onDeleteNode?: () => void
  onBringToFront?: () => void
  onSendToBack?: () => void
  onEditInChat?: () => void
  externalPrompt?: string | null
  onExternalPromptConsumed?: () => void
}

export default function Sidebar({ selectedNode, provider, collapsed, onToggleCollapse, onArtboardReady, onUpdateNode, onUpdateNodeData, onDeleteNode, onBringToFront, onSendToBack, onEditInChat, externalPrompt, onExternalPromptConsumed }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('setup')
  const [phase, setPhase] = useState<Phase>('idle')
  const [userPrompt, setUserPrompt] = useState('')
  const [brief, setBrief] = useState<Brief | null>(null)
  const [briefSiteDir, setBriefSiteDir] = useState<string | null>(null)

  // Handle external prompt from toolbar
  useEffect(() => {
    if (externalPrompt === null || externalPrompt === undefined) return
    setActiveTab('setup')
    if (externalPrompt === '') {
      // Just show the generate panel (empty = open setup)
      setPhase('idle')
    } else if (phase === 'idle') {
      // Non-empty = start brief generation
      handlePrepareBrief(externalPrompt)
    }
    onExternalPromptConsumed?.()
  }, [externalPrompt])

  const handlePrepareBrief = useCallback((prompt: string) => {
    setUserPrompt(prompt)
    setPhase('preparing')
    setBrief(null)
    setBriefSiteDir(null)
  }, [])

  const handleBriefReady = useCallback((result: { brief: Brief; siteDir: string; sessionId?: string }) => {
    setBrief(result.brief)
    setBriefSiteDir(result.siteDir)
    setPhase('brief')
  }, [])

  const handleBuild = useCallback((editedBrief: Brief) => {
    setBrief(editedBrief)
    setPhase('building')
  }, [])

  const handleBuildComplete = useCallback((result: {
    previewUrl: string
    fileCount: number
    files: string[]
    outputDir: string
    sessionId?: string
    isVite?: boolean
  }) => {
    const dirName = result.outputDir.split('/').pop() || result.outputDir
    onArtboardReady(dirName, result.sessionId, provider)
    setPhase('idle')
  }, [onArtboardReady, provider])

  const handleRegenerateBrief = useCallback(() => {
    setPhase('preparing')
    setBrief(null)
  }, [])

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

  const renderSetupContent = () => {
    switch (phase) {
      case 'preparing':
        return (
          <CreativeDirectorTerminal
            userPrompt={userPrompt}
            onComplete={handleBriefReady}
            onError={(msg) => {
              console.error('Brief generation failed:', msg)
              setPhase('idle')
            }}
          />
        )

      case 'brief':
        return brief ? (
          <BriefEditor
            brief={brief}
            onChange={setBrief}
            onBuild={handleBuild}
            onRegenerate={handleRegenerateBrief}
            building={false}
          />
        ) : null

      case 'building':
        return (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 py-2 bg-[#15151a] rounded-lg mb-2">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
                <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
                <span className="w-2 h-2 rounded-full bg-[#28c840]" />
              </div>
              <span className="text-[11px] text-zinc-500 font-mono ml-1">building...</span>
            </div>
            <ClaudeTerminal
              userPrompt=""
              streamUrl="/api/generate/stream"
              requestBody={{ brief, siteDir: briefSiteDir, userPrompt: '' }}
              onComplete={handleBuildComplete}
              onError={(msg) => {
                console.error('Build failed:', msg)
                setPhase('brief')
              }}
              onFileChange={() => {}}
            />
          </div>
        )

      default: // idle
        return (
          <div className="flex flex-col gap-4">
            <PinBoard />
            <GitHubPanel />
            <PresetsPanel />
            <GeneratePanel
              provider={provider}
              preparing={false}
              onPrepareBrief={handlePrepareBrief}
            />
          </div>
        )
    }
  }

  return (
    <div className="w-[380px] shrink-0 flex flex-col h-full" style={{ background: 'var(--bg)', borderRight: '1px solid var(--border)' }}>
      <div className="flex items-center border-b" style={{ borderColor: 'var(--border)' }}>
        <button className={tabClass('setup')} style={activeTab === 'setup' ? { borderColor: 'var(--accent)' } : {}} onClick={() => setActiveTab('setup')}>Setup</button>
        <button className={tabClass('chat')} style={activeTab === 'chat' ? { borderColor: 'var(--accent)' } : {}} onClick={() => setActiveTab('chat')}>Chat</button>
        <button className={tabClass('inspector')} style={activeTab === 'inspector' ? { borderColor: 'var(--accent)' } : {}} onClick={() => setActiveTab('inspector')}>Inspector</button>
        <div className="flex-1" />
        {phase !== 'idle' && (
          <button
            className="px-2 py-1 text-xs opacity-50 hover:opacity-100"
            onClick={() => setPhase('idle')}
          >
            Back
          </button>
        )}
        <button className="px-2 py-1 text-xs opacity-50 hover:opacity-100" onClick={onToggleCollapse}>Hide</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'setup' && renderSetupContent()}

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
