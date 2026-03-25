"use client";

import { useEffect, useRef, useState } from "react";
import type { Brief } from "@/lib/brief";

type EntryType = "system" | "tool-start" | "tool-result" | "text" | "cost";

interface TerminalEntry {
  id: number;
  type: EntryType;
  content: string;
  meta?: string;
}

interface CreativeDirectorTerminalProps {
  userPrompt: string;
  onComplete: (result: { brief: Brief; siteDir: string; sessionId?: string }) => void;
  onError: (message: string) => void;
}

export default function CreativeDirectorTerminal({ userPrompt, onComplete, onError }: CreativeDirectorTerminalProps) {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    const abortController = new AbortController();
    let cancelled = false;

    function addEntry(type: EntryType, content: string, meta?: string) {
      setEntries((prev) => [...prev, { id: ++idRef.current, type, content, meta }]);
    }

    async function run() {
      addEntry("system", "Creative Director is analyzing your inputs...");

      let res: Response;
      try {
        res = await fetch("/api/generate/brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userPrompt }),
          signal: abortController.signal,
        });
      } catch (e: any) {
        if (e.name !== "AbortError") onError(e.message);
        return;
      }

      if (cancelled) return;
      if (!res.ok) {
        onError(`Brief generation failed: ${res.status}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { onError("No response body"); return; }

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
          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            handleEvent(event, addEntry);
          } catch {}
        }
      }
    }

    function handleEvent(event: any, add: typeof addEntry) {
      if (event.type === "done") {
        if (event.brief) {
          add("system", "Brief ready!");
          onComplete({ brief: event.brief, siteDir: event.siteDir, sessionId: event.sessionId });
        } else {
          onError("Failed to generate brief");
        }
        return;
      }

      if (event.type === "error") {
        add("system", `Error: ${event.message}`);
        onError(event.message);
        return;
      }

      if (event.type === "system" && event.subtype === "init") {
        add("system", `Connected to ${event.model || "Claude"}`);
        return;
      }

      if (event.type === "assistant" && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === "tool_use") {
            const name = block.name;
            const input = block.input || {};
            if (name === "Read") {
              const fileName = (input.file_path || "").split("/").pop() || "";
              add("tool-start", `Analyzing ${fileName}`);
            } else if (name === "Bash") {
              add("tool-start", `Running: ${(input.command || "").slice(0, 100)}`);
            } else {
              add("tool-start", `${name}`);
            }
          } else if (block.type === "text" && block.text?.trim()) {
            add("text", block.text.trim());
          }
        }
        return;
      }

      if (event.type === "user" && event.tool_use_result) {
        const r = event.tool_use_result;
        if (typeof r.content === "string" && r.content.length > 0) {
          add("tool-result", r.content.slice(0, 200));
        } else {
          add("tool-result", "Done");
        }
        return;
      }

      if (event.type === "result" && event.subtype === "success") {
        if (event.total_cost_usd) {
          add("cost", `$${event.total_cost_usd.toFixed(4)}`, `${event.num_turns} turns, ${(event.duration_ms / 1000).toFixed(1)}s`);
        }
        return;
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
    <div className="flex h-full flex-col bg-[var(--bg)]">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#15151a] border-b border-[var(--border)] shrink-0">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[11px] text-zinc-500 font-mono ml-1">creative director</span>
        <span className="ml-auto text-[10px] text-zinc-600">{entries.length} events</span>
      </div>
      <div ref={scrollRef} className="flex-1 bg-[#0c0c0f] p-4 font-mono text-[11px] leading-[1.6] overflow-y-auto">
        {entries.map((entry) => (
          <div key={entry.id} className={`mb-0.5 ${entry.type === "tool-start" ? "mt-2" : ""}`}>
            {entry.type === "system" && <div className="text-violet-400 font-semibold py-0.5">{entry.content}</div>}
            {entry.type === "tool-start" && <div className="text-amber-300 font-semibold">{entry.content}</div>}
            {entry.type === "tool-result" && <div className="text-zinc-600 text-[10px] pl-4">{entry.content}</div>}
            {entry.type === "text" && <div className="text-zinc-400 py-1 whitespace-pre-wrap">{entry.content}</div>}
            {entry.type === "cost" && (
              <div className="flex items-center gap-3 text-zinc-600 text-[10px] pt-1 border-t border-zinc-800/50 mt-2">
                <span>Cost: {entry.content}</span>
                {entry.meta && <span>{entry.meta}</span>}
              </div>
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
