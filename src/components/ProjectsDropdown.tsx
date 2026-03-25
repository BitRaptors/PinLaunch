"use client";

import { useState, useEffect, useRef } from "react";

interface Project {
  id: number;
  name: string;
  site_dir: string;
  provider: string;
  framework: string | null;
  session_id: string | null;
  github_repo: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectsDropdownProps {
  onSelectProject: (project: Project) => void;
  onNewProject: () => void;
  onDeleteProject?: (siteDir: string) => void;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr + "Z"); // SQLite datetime is UTC
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWeek = Math.floor(diffDay / 7);
  return `${diffWeek}w ago`;
}

export default function ProjectsDropdown({ onSelectProject, onNewProject, onDeleteProject }: ProjectsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Fetch projects when opened
  useEffect(() => {
    if (!open) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => {});
  }, [open]);

  const handleRename = async (id: number) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    await fetch("/api/projects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName.trim() }),
    });
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: editName.trim() } : p)));
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    const project = projects.find((p) => p.id === id);
    await fetch("/api/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (project) onDeleteProject?.(project.site_dir);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="group flex items-center gap-2 rounded-full bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] shadow-sm transition-all duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--text)] hover:shadow-md"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        Projects
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 w-[320px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Recent Projects</span>
            <button
              onClick={() => {
                setOpen(false);
                onNewProject();
              }}
              className="flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-semibold text-white transition-all hover:bg-[var(--accent-hover)]"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New
            </button>
          </div>

          {/* Project list */}
          <div className="max-h-[360px] overflow-y-auto">
            {projects.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-[var(--text-muted)]">No projects yet</p>
                <p className="text-[10px] text-[var(--text-muted)] opacity-60 mt-1">Generate a landing page to get started</p>
              </div>
            )}

            {projects.map((project) => (
              <div
                key={project.id}
                className="group/item flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-hover)] cursor-pointer border-b border-[var(--border)] last:border-b-0"
                onClick={() => {
                  if (editingId !== project.id) {
                    setOpen(false);
                    onSelectProject(project);
                  }
                }}
              >
                {/* Framework icon */}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  project.framework === "React (Vite)" ? "bg-cyan-500/10 text-cyan-400" : "bg-sky-500/10 text-sky-400"
                }`}>
                  {project.framework === "React (Vite)" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  )}
                </div>

                {/* Name and meta */}
                <div className="flex-1 min-w-0">
                  {editingId === project.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRename(project.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(project.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 text-xs text-[var(--text)]"
                    />
                  ) : (
                    <p className="text-xs font-semibold text-[var(--text)] truncate">{project.name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-[var(--text-muted)]">{timeAgo(project.updated_at)}</span>
                    <span className="text-[10px] text-[var(--text-muted)] opacity-60">
                      {project.framework === "React (Vite)" ? "React" : "HTML + Tailwind"}
                    </span>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                      project.provider === "claude" ? "bg-orange-400" : "bg-blue-400"
                    }`} title={project.provider} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fetch("/api/projects/reveal", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ siteDir: project.site_dir }),
                      });
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text)]"
                    title="Show in file explorer"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      <line x1="12" y1="11" x2="12" y2="17" />
                      <polyline points="9 14 12 11 15 14" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(project.id);
                      setEditName(project.name);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text)]"
                    title="Rename"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(project.id);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400"
                    title="Delete"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
