"use client";

import { useState } from "react";

interface GeneratePanelProps {
  provider: string;
  preparing: boolean;
  onPrepareBrief: (userPrompt: string) => void;
}

export default function GeneratePanel({ provider, preparing, onPrepareBrief }: GeneratePanelProps) {
  const [prompt, setPrompt] = useState("");

  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
      <div className="mb-3 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <h3 className="text-sm font-bold text-[var(--text)]">Generate</h3>
        {provider && (
          <span className="ml-auto rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
            {provider}
          </span>
        )}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Additional guidance... e.g. 'Dark theme, focus on developer experience, include code snippets'"
        rows={3}
        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm resize-none placeholder:text-[var(--text-muted)]"
      />

      <button
        onClick={() => onPrepareBrief(prompt)}
        disabled={preparing}
        className="mt-3 w-full rounded-full bg-[var(--accent)] py-3 text-sm font-bold text-white shadow-[0_2px_16px_var(--accent-glow)] transition-all duration-200 hover:bg-[var(--accent-hover)] hover:shadow-[0_4px_24px_var(--accent-glow)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100"
      >
        {preparing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Preparing Brief...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Prepare Brief
          </span>
        )}
      </button>
    </div>
  );
}
