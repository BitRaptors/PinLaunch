"use client";

import { useState } from "react";
import type { Brief, BriefSection } from "@/lib/brief";

interface BriefEditorProps {
  brief: Brief;
  onChange: (brief: Brief) => void;
  onBuild: (brief: Brief) => void;
  onRegenerate: () => void;
  building: boolean;
}

export default function BriefEditor({ brief, onChange, onBuild, onRegenerate, building }: BriefEditorProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  function updateColor(index: number, field: keyof Brief["colors"][0], value: string) {
    const colors = [...brief.colors];
    colors[index] = { ...colors[index], [field]: value };
    onChange({ ...brief, colors });
  }

  function updateTypography(field: keyof Brief["typography"], value: string) {
    onChange({ ...brief, typography: { ...brief.typography, [field]: value } });
  }

  function updateSection(index: number, field: keyof BriefSection, value: string) {
    const sections = [...brief.sections];
    sections[index] = { ...sections[index], [field]: value };
    onChange({ ...brief, sections });
  }

  function moveSection(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= brief.sections.length) return;
    const sections = [...brief.sections];
    [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
    onChange({ ...brief, sections });
  }

  function removeSection(index: number) {
    const sections = brief.sections.filter((_, i) => i !== index);
    onChange({ ...brief, sections });
  }

  function updateProduct(field: keyof Brief["product"], value: any) {
    onChange({ ...brief, product: { ...brief.product, [field]: value } });
  }

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        <h2 className="text-sm font-bold text-[var(--text)]">Creative Brief</h2>
        <span className="ml-auto text-[10px] text-[var(--text-muted)]">{brief.sections.length} sections</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Product Info */}
        <div className="rounded-[var(--radius-md)] bg-[var(--surface)] p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Product</h3>
          <div className="space-y-2">
            <input
              value={brief.product.name}
              onChange={(e) => updateProduct("name", e.target.value)}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm font-semibold"
              placeholder="Product name"
            />
            <input
              value={brief.product.tagline}
              onChange={(e) => updateProduct("tagline", e.target.value)}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm"
              placeholder="One-line tagline"
            />
            <input
              value={brief.product.techStack}
              onChange={(e) => updateProduct("techStack", e.target.value)}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text-muted)]"
              placeholder="Tech stack"
            />
          </div>
        </div>

        {/* Color Palette */}
        <div className="rounded-[var(--radius-md)] bg-[var(--surface)] p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Color Palette</h3>
          <div className="grid grid-cols-3 gap-2">
            {brief.colors.map((color, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-[var(--bg)] p-2">
                <input
                  type="color"
                  value={color.hex}
                  onChange={(e) => updateColor(i, "hex", e.target.value)}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-[var(--text)] truncate">{color.name}</p>
                  <p className="text-[9px] text-[var(--text-muted)] font-mono">{color.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div className="rounded-[var(--radius-md)] bg-[var(--surface)] p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Typography</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Headings</label>
              <input
                value={brief.typography.headings}
                onChange={(e) => updateTypography("headings", e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Body</label>
              <input
                value={brief.typography.body}
                onChange={(e) => updateTypography("body", e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs"
              />
            </div>
          </div>
          <div className="mt-2">
            <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Scale</label>
            <input
              value={brief.typography.scale}
              onChange={(e) => updateTypography("scale", e.target.value)}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs"
            />
          </div>
        </div>

        {/* Sections */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Sections</h3>
          <div className="space-y-2">
            {brief.sections.map((section, i) => {
              const isExpanded = expandedSection === section.id;
              return (
                <div key={section.id} className="rounded-[var(--radius-md)] bg-[var(--surface)] overflow-hidden">
                  {/* Section header — always visible */}
                  <div
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
                    onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded">
                      {section.type}
                    </span>
                    <span className="text-xs text-[var(--text)] font-medium truncate flex-1">{section.headline}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveSection(i, -1); }}
                        disabled={i === 0}
                        className="h-5 w-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] disabled:opacity-20"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveSection(i, 1); }}
                        disabled={i === brief.sections.length - 1}
                        className="h-5 w-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] disabled:opacity-20"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeSection(i); }}
                        className="h-5 w-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-[var(--text-muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded section editor */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-[var(--border)]">
                      <div className="pt-2">
                        <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Headline</label>
                        <input
                          value={section.headline}
                          onChange={(e) => updateSection(i, "headline", e.target.value)}
                          className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Body</label>
                        <textarea
                          value={section.body}
                          onChange={(e) => updateSection(i, "body", e.target.value)}
                          rows={3}
                          className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs resize-none"
                        />
                      </div>
                      {section.cta !== undefined && (
                        <div>
                          <label className="text-[10px] text-[var(--text-muted)] mb-1 block">CTA Button</label>
                          <input
                            value={section.cta || ""}
                            onChange={(e) => updateSection(i, "cta", e.target.value)}
                            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Design Notes</label>
                        <textarea
                          value={section.notes || ""}
                          onChange={(e) => updateSection(i, "notes", e.target.value)}
                          rows={2}
                          className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[10px] text-[var(--text-muted)] resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Design Notes */}
        <div className="rounded-[var(--radius-md)] bg-[var(--surface)] p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Design Notes</h3>
          <textarea
            value={brief.designNotes}
            onChange={(e) => onChange({ ...brief, designNotes: e.target.value })}
            rows={3}
            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs resize-none"
          />
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 shrink-0">
        <button
          onClick={onRegenerate}
          disabled={building}
          className="rounded-full px-4 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-30"
        >
          Regenerate Brief
        </button>
        <button
          onClick={() => onBuild(brief)}
          disabled={building}
          className="ml-auto rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-white shadow-[0_2px_16px_var(--accent-glow)] transition-all hover:bg-[var(--accent-hover)] hover:shadow-[0_4px_24px_var(--accent-glow)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100"
        >
          {building ? (
            <span className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Building...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Build Landing Page
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
