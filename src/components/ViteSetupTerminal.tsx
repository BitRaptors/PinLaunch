"use client";

import { useEffect, useRef, useState } from "react";

interface ViteSetupTerminalProps {
  siteDir: string;
  onComplete: (result: { previewUrl: string; isVite: boolean }) => void;
  onError: (message: string) => void;
}

interface TerminalEntry {
  id: number;
  type: "system" | "log";
  content: string;
}

export default function ViteSetupTerminal({ siteDir, onComplete, onError }: ViteSetupTerminalProps) {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    const abortController = new AbortController();
    let cancelled = false;

    function addEntry(type: TerminalEntry["type"], content: string) {
      setEntries((prev) => [...prev, { id: ++idRef.current, type, content }]);
    }

    async function run() {
      addEntry("system", "Setting up Vite dev server...");

      let res: Response;
      try {
        res = await fetch("/api/vite/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteDir }),
          signal: abortController.signal,
        });
      } catch (e: any) {
        if (e.name !== "AbortError") onError(e.message);
        return;
      }

      if (cancelled) return;
      if (!res.ok) {
        onError(`Setup request failed: ${res.status}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        onError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done || cancelled) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "vite-setup") {
              if (event.phase === "install" || event.phase === "starting" || event.phase === "ready" || event.phase === "error") {
                addEntry("system", event.message);
              } else if (event.phase === "install-log" || event.phase === "starting-log") {
                addEntry("log", event.message);
              }
            } else if (event.type === "done") {
              if (event.previewUrl) {
                addEntry("system", "Dev server ready!");
                onComplete({ previewUrl: event.previewUrl, isVite: true });
              } else {
                onError("Dev server setup failed");
              }
            }
          } catch {}
        }
      }
    }

    run();

    return () => {
      cancelled = true;
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  return (
    <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#15151a] border-b border-[var(--border)]">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[11px] text-zinc-500 font-mono ml-1">vite setup</span>
      </div>
      <div
        ref={scrollRef}
        className="bg-[#0c0c0f] p-4 font-mono text-[11px] leading-[1.6] max-h-48 overflow-y-auto"
      >
        {entries.map((entry) => (
          <div key={entry.id} className="mb-0.5">
            {entry.type === "system" ? (
              <div className="text-emerald-400 font-semibold py-0.5">{entry.content}</div>
            ) : (
              <div className="text-zinc-600 text-[10px] pl-4">{entry.content}</div>
            )}
          </div>
        ))}
        {entries.length === 0 && (
          <div className="flex items-center gap-2 text-zinc-600">
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Connecting...
          </div>
        )}
      </div>
    </div>
  );
}
