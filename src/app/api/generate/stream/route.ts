import { getDb } from "@/lib/db";
import { streamClaudeGeneration, getActiveFramework } from "@/lib/generate";
import { getRepoContent } from "@/lib/github";
import { startViteServer, detectViteProject } from "@/lib/vite-server";
import { NextRequest } from "next/server";
import path from "path";

export async function POST(req: NextRequest) {
  let userPrompt: string;
  try {
    ({ userPrompt } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const db = getDb();

  const pins = db.prepare("SELECT url, title, description, thumbnail FROM pins").all() as any[];
  const activePresets = db
    .prepare("SELECT category, name, value FROM presets WHERE is_active = 1")
    .all() as any[];
  const settingsRows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of settingsRows) settings[row.key] = row.value;

  let repoContent = null;
  if (settings.github_repo) {
    try {
      repoContent = await getRepoContent(settings.github_token || null, settings.github_repo);
    } catch {}
  }

  const input = { pins, repoContent, userPrompt: userPrompt || "", presets: activePresets };
  const dirName = `site-${Date.now()}`;
  const outputDir = path.join(process.cwd(), "output", dirName);

  const framework = getActiveFramework(activePresets);
  const isVitePreset = framework === "React (Vite)";

  // Derive project name from repo or timestamp
  const repoName = settings.github_repo?.split("/").pop() || null;
  const projectName = repoName ? `${repoName} Landing Page` : `Project ${new Date().toLocaleDateString()}`;

  const claudeStream = streamClaudeGeneration(input, outputDir);
  const encoder = new TextEncoder();

  // Wrap Claude stream: intercept "done" event, optionally append Vite setup phase
  const wrappedStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = claudeStream.getReader();
      const decoder = new TextDecoder();
      let closed = false;
      let capturedSessionId: string | undefined;

      function emit(data: string) {
        if (!closed) {
          try { controller.enqueue(encoder.encode(`data: ${data}\n\n`)); } catch { closed = true; }
        }
      }

      function close() {
        if (!closed) {
          closed = true;
          try { controller.close(); } catch {}
        }
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });

          // Capture session_id from init event
          if (text.includes('"subtype":"init"')) {
            try {
              const initMatch = text.match(/^data: (.+)$/m);
              if (initMatch) {
                const initParsed = JSON.parse(initMatch[1]);
                if (initParsed.session_id) capturedSessionId = initParsed.session_id;
              }
            } catch {}
          }

          // Check if this chunk contains the "done" event
          if (text.includes('"type":"done"')) {
            const dataMatch = text.match(/^data: (.+)$/m);
            if (dataMatch) {
              try {
                const parsed = JSON.parse(dataMatch[1]);
                if (parsed.type === "done") {
                  const isVite = isVitePreset && detectViteProject(outputDir);

                  if (isVite) {
                    // Emit Claude completion without closing, then run Vite setup
                    emit(JSON.stringify({ type: "system", subtype: "info", message: `${parsed.fileCount} file(s) generated. Setting up dev server...` }));

                    try {
                      const server = await startViteServer(dirName, (event) => {
                        emit(JSON.stringify(event));
                      });
                      parsed.previewUrl = server.url;
                      parsed.isVite = true;
                    } catch (err: any) {
                      emit(JSON.stringify({ type: "vite-setup", phase: "error", message: `Dev server failed: ${err.message}` }));
                      parsed.previewUrl = `/api/preview/${dirName}/`;
                      parsed.isVite = false;
                    }
                  } else {
                    parsed.previewUrl = `/api/preview/${dirName}/`;
                    parsed.isVite = false;
                  }

                  // Save project record
                  try {
                    const result = db.prepare(
                      "INSERT INTO projects (name, site_dir, provider, framework, session_id, github_repo) VALUES (?, ?, ?, ?, ?, ?)"
                    ).run(projectName, dirName, "claude", framework, capturedSessionId || null, settings.github_repo || null);
                    parsed.projectId = result.lastInsertRowid;
                  } catch {}

                  emit(JSON.stringify(parsed));
                  close();
                  return;
                }
              } catch {}
            }
            // If parsing failed, pass through
            controller.enqueue(value);
          } else {
            controller.enqueue(value);
          }
        }
      } catch (err) {
        // Stream error
      }
      close();
    },
  });

  return new Response(wrappedStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
