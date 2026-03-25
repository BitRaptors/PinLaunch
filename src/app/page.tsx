"use client";

import { useState, useCallback, useEffect } from "react";
import Header from "@/components/Header";
import PinBoard from "@/components/PinBoard";
import GitHubPanel from "@/components/GitHubPanel";
import PresetsPanel from "@/components/PresetsPanel";
import GeneratePanel from "@/components/GeneratePanel";
import PreviewFrame from "@/components/PreviewFrame";
import RefinementChat from "@/components/RefinementChat";
import ViteSetupTerminal from "@/components/ViteSetupTerminal";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function loadSession(): { siteDir: string | null; sessionId?: string; provider: string; previewUrl?: string; isVite?: boolean } {
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [refinementMessages, setRefinementMessages] = useState<ChatMessage[]>([]);
  const [viteBooting, setViteBooting] = useState<string | null>(null); // siteDir being booted

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

  // Clear stale Vite sessions on load (dev server won't survive page reload)
  useEffect(() => {
    if (isVite && siteDir) {
      fetch(`/api/vite/status?siteDir=${siteDir}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.running) {
            setPreviewUrl(data.url);
          } else {
            // Need to reboot — show ViteSetupTerminal
            setViteBooting(siteDir);
          }
        })
        .catch(() => {
          setSiteDir(null);
          setPreviewUrl(undefined);
          setIsVite(false);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist session to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem("pinlaunch_session", JSON.stringify({ siteDir, sessionId, provider, previewUrl, isVite }));
    } catch {}
  }, [siteDir, sessionId, provider, previewUrl, isVite]);

  const handleSiteReady = useCallback((dir: string, sid?: string, prov?: string, preview?: string, vite?: boolean) => {
    setSiteDir(dir);
    setSessionId(sid);
    if (prov) setProvider(prov);
    setPreviewUrl(preview);
    setIsVite(vite || false);
    setViteBooting(null);
    setRefreshTrigger((n) => n + 1);
    setRefinementMessages([]);
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

    if (projectIsVite) {
      // Check if Vite dev server is already running
      try {
        const res = await fetch(`/api/vite/status?siteDir=${project.site_dir}`);
        const data = await res.json();
        if (data.running) {
          setPreviewUrl(data.url);
          setViteBooting(null);
        } else {
          // Need to boot Vite — show setup terminal
          setPreviewUrl(undefined);
          setViteBooting(project.site_dir);
        }
      } catch {
        setPreviewUrl(undefined);
        setViteBooting(project.site_dir);
      }
    } else {
      // Tailwind — static preview works immediately
      setPreviewUrl(`/api/preview/${project.site_dir}/`);
      setViteBooting(null);
      setRefreshTrigger((n) => n + 1);
    }
  }, []);

  const handleNewProject = useCallback(() => {
    setSiteDir(null);
    setSessionId(undefined);
    setPreviewUrl(undefined);
    setIsVite(false);
    setViteBooting(null);
    setRefinementMessages([]);
    try { sessionStorage.removeItem("pinlaunch_session"); } catch {}
  }, []);

  return (
    <>
      <Header onSelectProject={handleSelectProject} onNewProject={handleNewProject} onSettingsChange={handleSettingsChange} />
      <main className="px-4 py-6">
        <div className="flex gap-5" style={{ height: "calc(100vh - 90px)" }}>
          {/* Left panel */}
          <div className="w-[380px] shrink-0 overflow-y-auto space-y-4 pr-1">
            <PinBoard />
            <GitHubPanel />
            <PresetsPanel />
            <GeneratePanel provider={provider} onSiteReady={handleSiteReady} onFileChange={handleFileChange} />
            {siteDir && !viteBooting && (
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

          {/* Right panel — preview or Vite boot terminal */}
          <div className="flex-1 rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
            {viteBooting ? (
              <div className="flex h-full flex-col bg-[var(--bg)]">
                <div className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                  <span className="text-xs text-[var(--text-muted)] font-mono">Starting dev server...</span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-full max-w-lg">
                    <ViteSetupTerminal
                      siteDir={viteBooting}
                      onComplete={(result) => {
                        setPreviewUrl(result.previewUrl);
                        setIsVite(true);
                        setViteBooting(null);
                        setRefreshTrigger((n) => n + 1);
                      }}
                      onError={() => {
                        // Fall back to static preview
                        setPreviewUrl(`/api/preview/${viteBooting}/`);
                        setIsVite(false);
                        setViteBooting(null);
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <PreviewFrame siteDir={siteDir} refreshTrigger={refreshTrigger} previewUrl={previewUrl} isVite={isVite} />
            )}
          </div>
        </div>
      </main>
    </>
  );
}
