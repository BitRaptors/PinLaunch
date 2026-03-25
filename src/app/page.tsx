"use client";

import { useState, useCallback, useEffect } from "react";
import PinBoard from "@/components/PinBoard";
import GitHubPanel from "@/components/GitHubPanel";
import PresetsPanel from "@/components/PresetsPanel";
import GeneratePanel from "@/components/GeneratePanel";
import PreviewFrame from "@/components/PreviewFrame";
import RefinementChat from "@/components/RefinementChat";

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

  // Clear stale Vite sessions on load (dev server won't survive page reload)
  useEffect(() => {
    if (isVite && previewUrl) {
      fetch(previewUrl, { mode: "no-cors" }).catch(() => {
        setSiteDir(null);
        setPreviewUrl(undefined);
        setIsVite(false);
        setSessionId(undefined);
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
    setRefreshTrigger((n) => n + 1);
    setRefinementMessages([]);
  }, []);

  const handleFileChange = useCallback(() => {
    setRefreshTrigger((n) => n + 1);
  }, []);

  const handleRefinementMessage = useCallback((msg: ChatMessage) => {
    setRefinementMessages((prev) => [...prev, msg]);
  }, []);

  return (
    <div className="flex gap-5" style={{ height: "calc(100vh - 90px)" }}>
      {/* Left panel */}
      <div className="w-[380px] shrink-0 overflow-y-auto space-y-4 pr-1">
        <PinBoard />
        <GitHubPanel />
        <PresetsPanel />
        <GeneratePanel onSiteReady={handleSiteReady} onFileChange={handleFileChange} />
        {siteDir && (
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

      {/* Right panel — preview */}
      <div className="flex-1 rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
        <PreviewFrame siteDir={siteDir} refreshTrigger={refreshTrigger} previewUrl={previewUrl} isVite={isVite} />
      </div>
    </div>
  );
}
