"use client";

import { useState } from "react";

interface PreviewFrameProps {
  siteDir?: string | null;
  refreshTrigger: number;
  previewUrl?: string;
  isVite?: boolean;
}

const VIEWPORTS = [
  { label: "Desktop", width: "100%", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
  { label: "Tablet", width: "768px", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> },
  { label: "Mobile", width: "375px", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> },
] as const;

export default function PreviewFrame({ siteDir, refreshTrigger, previewUrl, isVite }: PreviewFrameProps) {
  const [viewport, setViewport] = useState(0);

  // Vite projects use dev server URL directly (HMR handles updates, no cache-buster needed)
  // HTML projects use static file server with cache-buster
  const src = siteDir ? (isVite && previewUrl ? previewUrl : `/api/preview/${siteDir}/?t=${refreshTrigger}`) : "";
  const displayUrl = siteDir ? (isVite && previewUrl ? previewUrl : `/api/preview/${siteDir}/`) : "";
  const vp = VIEWPORTS[viewport];

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        {/* Viewport toggles */}
        <div className="flex rounded-full bg-[var(--bg-elevated)] p-0.5">
          {VIEWPORTS.map((v, i) => (
            <button
              key={v.label}
              onClick={() => setViewport(i)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                viewport === i
                  ? "bg-[var(--surface-hover)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
              title={v.label}
            >
              {v.icon}
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>

        {/* URL display */}
        <div className="mx-3 flex-1 rounded-full bg-[var(--bg-elevated)] px-3 py-1.5">
          <span className="text-xs text-[var(--text-muted)] font-mono truncate block">{displayUrl}</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Refresh */}
          <button
            onClick={() => {
              const iframe = document.querySelector<HTMLIFrameElement>("#preview-iframe");
              if (iframe) {
                iframe.src = isVite && previewUrl ? previewUrl : `/api/preview/${siteDir}/?t=${Date.now()}`;
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-all hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
            title="Refresh"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>

          {/* Open in new tab */}
          <a
            href={isVite && previewUrl ? previewUrl : `/api/preview/${siteDir}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-all hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
            title="Open in new tab"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>

      {/* Iframe container or empty state */}
      <div className="flex-1 flex items-start justify-center overflow-auto bg-neutral-900/50">
        {siteDir ? (
          <iframe
            id="preview-iframe"
            src={src}
            style={{ width: vp.width, height: "100%", maxWidth: "100%" }}
            className="bg-white transition-[width] duration-300 ease-out"
            title="Site Preview"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full select-none">
            {/* Illustration */}
            <svg width="180" height="140" viewBox="0 0 180 140" fill="none" className="mb-6 opacity-60">
              {/* Browser window */}
              <rect x="20" y="16" width="140" height="100" rx="8" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" opacity="0.3" />
              <line x1="20" y1="32" x2="160" y2="32" stroke="var(--text-muted)" strokeWidth="1.5" opacity="0.3" />
              <circle cx="32" cy="24" r="3" fill="#ff5f57" opacity="0.5" />
              <circle cx="42" cy="24" r="3" fill="#febc2e" opacity="0.5" />
              <circle cx="52" cy="24" r="3" fill="#28c840" opacity="0.5" />
              {/* Content lines */}
              <rect x="40" y="46" width="60" height="6" rx="3" fill="var(--text-muted)" opacity="0.15" />
              <rect x="50" y="58" width="40" height="4" rx="2" fill="var(--text-muted)" opacity="0.1" />
              <rect x="36" y="72" width="68" height="4" rx="2" fill="var(--text-muted)" opacity="0.1" />
              <rect x="44" y="82" width="52" height="4" rx="2" fill="var(--text-muted)" opacity="0.1" />
              {/* Sparkle accents */}
              <path d="M145 50l3-8 3 8-8 3 8 3-3 8-3-8-8-3z" fill="var(--accent)" opacity="0.4" />
              <path d="M35 95l2-5 2 5-5 2 5 2-2 5-2-5-5-2z" fill="var(--accent)" opacity="0.25" />
              {/* Rocket */}
              <g transform="translate(90, 75)" opacity="0.35">
                <path d="M0-20c0 0 4-8 0-16 0 0-4 8 0 16z" fill="var(--text-muted)" />
                <ellipse cx="0" cy="-12" rx="5" ry="8" fill="var(--text-muted)" opacity="0.5" />
                <path d="M-3 -4l-4 6h4z" fill="var(--accent)" opacity="0.5" />
                <path d="M3 -4l4 6h-4z" fill="var(--accent)" opacity="0.5" />
                <ellipse cx="0" cy="0" rx="2" ry="3" fill="var(--accent)" opacity="0.4" />
              </g>
            </svg>
            <p className="text-sm font-semibold text-[var(--text-muted)] mb-1.5">No preview yet</p>
            <p className="text-xs text-[var(--text-muted)] opacity-60 text-center max-w-[240px] leading-relaxed">
              Configure your settings on the left and hit <span className="font-medium text-[var(--accent)] opacity-80">Generate</span> to build your landing page
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
