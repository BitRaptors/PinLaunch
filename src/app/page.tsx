"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Header from "@/components/Header";
import PinBoard from "@/components/PinBoard";
import GitHubPanel from "@/components/GitHubPanel";
import PresetsPanel from "@/components/PresetsPanel";
import GeneratePanel from "@/components/GeneratePanel";
import PreviewFrame from "@/components/PreviewFrame";
import RefinementChat from "@/components/RefinementChat";
import ViteSetupTerminal from "@/components/ViteSetupTerminal";
import CreativeDirectorTerminal from "@/components/CreativeDirectorTerminal";
import BriefEditor from "@/components/BriefEditor";
import ClaudeTerminal from "@/components/ClaudeTerminal";
import type { Brief } from "@/lib/brief";

type Phase = "empty" | "preparing" | "brief" | "building" | "preview" | "vite-booting";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function loadSession(): { siteDir: string | null; sessionId?: string; provider: string; previewUrl?: string; isVite?: boolean; phase?: Phase } {
  if (typeof window === "undefined") return { siteDir: null, provider: "gemini" };
  try {
    const saved = sessionStorage.getItem("pinlaunch_session");
    if (saved) return JSON.parse(saved);
  } catch {}
  return { siteDir: null, provider: "gemini" };
}

export default function Home() {
  const [siteDir, setSiteDir] = useState<string | null>(() => loadSession().siteDir);
  const [sessionId, setSessionId] = useState<string | undefined>(() => loadSession().sessionId);
  const [provider, setProvider] = useState<string>(() => loadSession().provider);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(() => loadSession().previewUrl);
  const [isVite, setIsVite] = useState<boolean>(() => loadSession().isVite || false);
  const [phase, setPhase] = useState<Phase>(() => loadSession().phase || "empty");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [refinementMessages, setRefinementMessages] = useState<ChatMessage[]>([]);

  // Brief state
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefSiteDir, setBriefSiteDir] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState("");

  // Preview tab state (for switching between preview, brief, and build log)
  type PreviewTab = "preview" | "brief" | "log";
  const [previewTab, setPreviewTab] = useState<PreviewTab>("preview");
  const [buildLog, setBuildLog] = useState<{ id: number; type: string; content: string; meta?: string }[]>([]);
  const buildLogIdRef = useRef(0);

  // Fetch initial provider from settings
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => { if (s.ai_provider) setProvider(s.ai_provider); })
      .catch(() => {});
  }, []);

  const handleSettingsChange = useCallback((settings: Record<string, string>) => {
    if (settings.ai_provider) setProvider(settings.ai_provider);
  }, []);

  // On load: check for stale Vite sessions or restore brief state
  useEffect(() => {
    if (phase === "preview" && isVite && siteDir) {
      fetch(`/api/vite/status?siteDir=${siteDir}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.running) {
            setPreviewUrl(data.url);
          } else {
            setPhase("vite-booting");
          }
        })
        .catch(() => {
          setSiteDir(null);
          setPhase("empty");
        });
    } else if (phase === "brief" && siteDir) {
      // Reload brief from disk
      fetch(`/api/brief?siteDir=${siteDir}`)
        .then((r) => r.ok ? r.json() : null)
        .then((b) => {
          if (b) { setBrief(b); setBriefSiteDir(siteDir); }
          else setPhase("empty");
        })
        .catch(() => setPhase("empty"));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist session
  useEffect(() => {
    try {
      sessionStorage.setItem("pinlaunch_session", JSON.stringify({ siteDir, sessionId, provider, previewUrl, isVite, phase }));
    } catch {}
  }, [siteDir, sessionId, provider, previewUrl, isVite, phase]);

  // --- Handlers ---

  const handlePrepareBrief = useCallback((prompt: string) => {
    setUserPrompt(prompt);
    setPhase("preparing");
    setBrief(null);
    setBriefSiteDir(null);
  }, []);

  const handleBriefReady = useCallback((result: { brief: Brief; siteDir: string; sessionId?: string }) => {
    setBrief(result.brief);
    setBriefSiteDir(result.siteDir);
    setSiteDir(result.siteDir);
    setSessionId(result.sessionId);
    setPhase("brief");
  }, []);

  const handleBuild = useCallback((editedBrief: Brief) => {
    setBrief(editedBrief);
    setBuildLog([]);
    buildLogIdRef.current = 0;
    setPhase("building");
  }, []);

  const handleRegenerateBrief = useCallback(() => {
    setPhase("preparing");
    setBrief(null);
  }, []);

  const handleBuildComplete = useCallback((result: {
    previewUrl: string;
    fileCount: number;
    files: string[];
    outputDir: string;
    sessionId?: string;
    isVite?: boolean;
  }) => {
    const dirName = result.outputDir.split("/").pop() || result.outputDir;
    setSiteDir(dirName);
    setSessionId(result.sessionId);
    setPreviewUrl(result.previewUrl);
    const vite = result.isVite || false;
    setIsVite(vite);
    setRefinementMessages([]);

    setPreviewTab("preview");
    if (vite && !result.previewUrl?.startsWith("http://localhost")) {
      setPhase("vite-booting");
    } else {
      setPhase("preview");
    }
    setRefreshTrigger((n) => n + 1);
  }, []);

  const handleFileChange = useCallback(() => {
    setRefreshTrigger((n) => n + 1);
  }, []);

  const handleRefinementMessage = useCallback((msg: ChatMessage) => {
    setRefinementMessages((prev) => [...prev, msg]);
  }, []);

  const handleSelectProject = useCallback(async (project: any) => {
    setSiteDir(project.site_dir);
    setSessionId(project.session_id || undefined);
    setProvider(project.provider);
    setRefinementMessages([]);

    const projectIsVite = project.framework === "React (Vite)";
    setIsVite(projectIsVite);

    // Check if project has a brief but no built site
    try {
      const briefRes = await fetch(`/api/brief?siteDir=${project.site_dir}`);
      if (briefRes.ok) {
        const b = await briefRes.json();
        setBrief(b);
        setBriefSiteDir(project.site_dir);
      }
    } catch {}

    if (projectIsVite) {
      try {
        const res = await fetch(`/api/vite/status?siteDir=${project.site_dir}`);
        const data = await res.json();
        if (data.running) {
          setPreviewUrl(data.url);
          setPhase("preview");
        } else {
          setPreviewUrl(undefined);
          setPhase("vite-booting");
        }
      } catch {
        setPreviewUrl(undefined);
        setPhase("vite-booting");
      }
    } else {
      setPreviewUrl(`/api/preview/${project.site_dir}/`);
      setPhase("preview");
      setRefreshTrigger((n) => n + 1);
    }
  }, []);

  const handleDeleteProject = useCallback((deletedSiteDir: string) => {
    // If the currently viewed project was deleted, reset to empty state
    if (siteDir === deletedSiteDir) {
      setSiteDir(null);
      setSessionId(undefined);
      setPreviewUrl(undefined);
      setIsVite(false);
      setPhase("empty");
      setBrief(null);
      setBriefSiteDir(null);
      setRefinementMessages([]);
      setBuildLog([]);
      try { sessionStorage.removeItem("pinlaunch_session"); } catch {}
    }
  }, [siteDir]);

  const handleNewProject = useCallback(() => {
    setSiteDir(null);
    setSessionId(undefined);
    setPreviewUrl(undefined);
    setIsVite(false);
    setPhase("empty");
    setBrief(null);
    setBriefSiteDir(null);
    setRefinementMessages([]);
    try { sessionStorage.removeItem("pinlaunch_session"); } catch {}
  }, []);

  // --- Render ---

  const renderRightPanel = () => {
    switch (phase) {
      case "preparing":
        return (
          <CreativeDirectorTerminal
            userPrompt={userPrompt}
            onComplete={handleBriefReady}
            onError={(msg) => {
              setPhase("empty");
              // Could show error toast
              console.error("Brief generation failed:", msg);
            }}
          />
        );

      case "brief":
        return brief ? (
          <BriefEditor
            brief={brief}
            onChange={setBrief}
            onBuild={handleBuild}
            onRegenerate={handleRegenerateBrief}
            building={false}
          />
        ) : null;

      case "building":
        return (
          <div className="flex h-full flex-col bg-[var(--bg)]">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#15151a] border-b border-[var(--border)] shrink-0">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              </div>
              <span className="text-[11px] text-zinc-500 font-mono ml-1">builder</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <ClaudeTerminal
                userPrompt=""
                streamUrl="/api/generate/stream"
                requestBody={{ brief, siteDir: briefSiteDir, userPrompt: "" }}
                onComplete={handleBuildComplete}
                onError={(msg) => {
                  setPhase("brief");
                  console.error("Build failed:", msg);
                }}
                onFileChange={handleFileChange}
                onLogEntry={(entry) => {
                  setBuildLog((prev) => [...prev, { id: ++buildLogIdRef.current, ...entry }]);
                }}
              />
            </div>
          </div>
        );

      case "vite-booting":
        return (
          <div className="flex h-full flex-col bg-[var(--bg)]">
            <div className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <span className="text-xs text-[var(--text-muted)] font-mono">Starting dev server...</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-lg">
                <ViteSetupTerminal
                  siteDir={siteDir!}
                  onComplete={(result) => {
                    setPreviewUrl(result.previewUrl);
                    setIsVite(true);
                    setPhase("preview");
                    setRefreshTrigger((n) => n + 1);
                  }}
                  onError={() => {
                    setPreviewUrl(`/api/preview/${siteDir}/`);
                    setIsVite(false);
                    setPhase("preview");
                  }}
                />
              </div>
            </div>
          </div>
        );

      case "preview":
        return (
          <div className="flex h-full flex-col">
            {/* Tab bar — only show if we have a brief or build log */}
            {(brief || buildLog.length > 0) && (
              <div className="flex items-center gap-0.5 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-1 shrink-0">
                {(["preview", "brief", "log"] as PreviewTab[]).map((tab) => {
                  if (tab === "brief" && !brief) return null;
                  if (tab === "log" && buildLog.length === 0) return null;
                  const labels: Record<PreviewTab, string> = { preview: "Preview", brief: "Brief", log: "Build Log" };
                  return (
                    <button
                      key={tab}
                      onClick={() => setPreviewTab(tab)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        previewTab === tab
                          ? "bg-[var(--bg-elevated)] text-[var(--text)] shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              {previewTab === "preview" && (
                <PreviewFrame siteDir={siteDir} refreshTrigger={refreshTrigger} previewUrl={previewUrl} isVite={isVite} />
              )}
              {previewTab === "brief" && brief && (
                <BriefEditor
                  brief={brief}
                  onChange={setBrief}
                  onBuild={handleBuild}
                  onRegenerate={handleRegenerateBrief}
                  building={false}
                />
              )}
              {previewTab === "log" && (
                <div className="h-full bg-[#0c0c0f] p-4 font-mono text-[11px] leading-[1.6] overflow-y-auto">
                  {buildLog.map((entry) => (
                    <div key={entry.id} className={`mb-0.5 ${entry.type === "tool-start" ? "mt-3" : ""}`}>
                      {entry.type === "system" && <div className="text-emerald-400 font-semibold py-0.5">{entry.content}</div>}
                      {entry.type === "tool-start" && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-amber-300 font-semibold">{entry.content}</span>
                          {entry.meta && <span className="text-zinc-600 text-[10px]">{entry.meta}</span>}
                        </div>
                      )}
                      {entry.type === "tool-result" && <div className="text-emerald-600 text-[10px] pl-4">{entry.content}</div>}
                      {entry.type === "text" && <div className="text-zinc-400 py-1 whitespace-pre-wrap">{entry.content}</div>}
                      {entry.type === "code-preview" && (
                        <pre className="text-zinc-600 text-[10px] leading-[1.5] pl-4 py-1 border-l-2 border-zinc-800 ml-1 max-h-[200px] overflow-hidden whitespace-pre-wrap break-all">{entry.content}</pre>
                      )}
                      {entry.type === "cost" && (
                        <div className="flex items-center gap-3 text-zinc-600 text-[10px] pt-1 border-t border-zinc-800/50 mt-2">
                          <span>Cost: {entry.content}</span>
                          {entry.meta && <span>{entry.meta}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                  {buildLog.length === 0 && <div className="text-zinc-600">No build log available</div>}
                </div>
              )}
            </div>
          </div>
        );

      default: // "empty"
        return <PreviewFrame siteDir={null} refreshTrigger={refreshTrigger} />;
    }
  };

  return (
    <>
      <Header onSelectProject={handleSelectProject} onNewProject={handleNewProject} onDeleteProject={handleDeleteProject} onSettingsChange={handleSettingsChange} />
      <main className="px-4 py-6">
        <div className="flex gap-5" style={{ height: "calc(100vh - 90px)" }}>
          {/* Left panel */}
          <div className="w-[380px] shrink-0 overflow-y-auto space-y-4 pr-1">
            <PinBoard />
            <GitHubPanel />
            <PresetsPanel />
            <GeneratePanel
              provider={provider}
              preparing={phase === "preparing"}
              onPrepareBrief={handlePrepareBrief}
            />
            {siteDir && phase === "preview" && (
              <RefinementChat
                siteDir={siteDir}
                sessionId={sessionId}
                provider={provider}
                isVite={isVite}
                messages={refinementMessages}
                onMessage={handleRefinementMessage}
                onFileChange={handleFileChange}
              />
            )}
          </div>

          {/* Right panel */}
          <div className="flex-1 rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
            {renderRightPanel()}
          </div>
        </div>
      </main>
    </>
  );
}
