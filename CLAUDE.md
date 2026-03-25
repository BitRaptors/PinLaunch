# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm run test         # Run all tests (vitest)
npm run test:watch   # Run tests in watch mode
npx vitest run src/lib/generate.test.ts  # Run a single test file
```

Alternatively, `bash start.sh` handles dependency install, .env setup, data directory creation, and starts the dev server.

## Architecture

PinLaunch is an AI-powered landing page builder. Users curate inspiration pins, connect a GitHub repo, select design presets, and generate a landing page via Gemini API or Claude Code CLI.

### Three layers

1. **Frontend** — Next.js 15 + React 19 + Tailwind CSS v4. Single-page app with dual-mode UI: setup panels (pins, GitHub, presets, generate) → preview mode (iframe + refinement chat). Session state stored in `sessionStorage`.

2. **API Routes** (`src/app/api/`) — Next.js route handlers. Key routes:
   - `generate/` — sync Gemini generation
   - `generate/stream/` — streaming Claude Code generation via SSE
   - `generate/refine/` — post-generation refinement (resumes Claude session or re-prompts Gemini)
   - `preview/[...path]/` — serves generated site files from `output/site-{timestamp}/`
   - `pins/`, `presets/`, `settings/`, `github/`, `screenshot/`, `health/` — CRUD and utilities

3. **Data** — SQLite via `better-sqlite3` (WAL mode). DB file at `data/builder.db`. Three tables: `pins`, `settings` (key-value), `presets` (one-active-per-category constraint).

### Generation pipeline

Prompt assembly in `src/lib/generate.ts` composes: system role from `src/lib/prompts.json` → section blueprint → active presets → pin descriptions → GitHub repo intelligence (README sections, dependencies, file tree via Octokit) → user guidance → output format instructions.

- **Gemini path**: HTTP API call, returns JSON `{filepath: content}`, files written to `output/site-{timestamp}/`
- **Claude path**: Spawns `claude` CLI with `--output-format stream-json`, streams SSE to `ClaudeTerminal` component, writes files directly

### Conventions

- Components: PascalCase `.tsx` files with default exports in `src/components/`
- Backend modules: lowercase names, named exports in `src/lib/`
- API routes: export named async functions matching HTTP methods (`GET`, `POST`, `PUT`, `DELETE`)
- Tests: co-located with source in `src/lib/`, use vitest `describe`/`it`/`expect`
- Path alias: `@/*` maps to `src/*`

### Environment

- `GEMINI_API_KEY` — required for Gemini generation (set in `.env` or via Settings UI)
- GitHub token and AI provider choice are stored in the SQLite `settings` table, configured through the Settings panel
