export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { getDb } from "@/lib/db";
import { getActiveFramework } from "@/lib/generate";
import { getRepoContent } from "@/lib/github";
import { buildCreativeDirectorPrompt } from "@/lib/creative-director";
import { saveBrief, Brief } from "@/lib/brief";
import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

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
  const activePresets = db.prepare("SELECT category, name, value FROM presets WHERE is_active = 1").all() as any[];
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
  fs.mkdirSync(outputDir, { recursive: true });

  const framework = getActiveFramework(activePresets);
  const repoName = settings.github_repo?.split("/").pop() || null;
  const projectName = repoName ? `${repoName} Landing Page` : `Project ${new Date().toLocaleDateString()}`;

  const cdPrompt = buildCreativeDirectorPrompt(input);

  // Copy pin screenshots so Claude can view them
  for (let i = 0; i < pins.length; i++) {
    const pin = pins[i];
    if (!pin.thumbnail) continue;
    const src = path.join(process.cwd(), "public", pin.thumbnail);
    try {
      if (fs.existsSync(src)) {
        const refDir = path.join(outputDir, "_reference");
        fs.mkdirSync(refDir, { recursive: true });
        fs.copyFileSync(src, path.join(refDir, `inspiration-${i + 1}.png`));
      }
    } catch {}
  }

  // Add screenshot viewing instructions for Claude
  const screenshotPaths = pins
    .map((p: any, i: number) => p.thumbnail ? path.join(outputDir, "_reference", `inspiration-${i + 1}.png`) : null)
    .filter(Boolean);

  let fullPrompt = cdPrompt;
  if (screenshotPaths.length > 0) {
    fullPrompt +=
      "\n\n# Reference Screenshots\n" +
      "IMPORTANT: Before producing the brief, use the Read tool to view each inspiration screenshot. " +
      "Study the visual design — colors, typography, spacing, layout, and aesthetic — then use those insights for your color palette and design notes.\n" +
      screenshotPaths.map((p, i) => `- Screenshot ${i + 1}: ${p}`).join("\n");
  }

  const encoder = new TextEncoder();
  const localClaude = path.join(process.cwd(), "node_modules", ".bin", "claude");
  const claudeBin = fs.existsSync(localClaude) ? localClaude : "claude";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      function emit(data: string) {
        if (!closed) {
          try { controller.enqueue(encoder.encode(`data: ${data}\n\n`)); } catch { closed = true; }
        }
      }
      function close() {
        if (!closed) { closed = true; try { controller.close(); } catch {} }
      }

      const proc = spawn(
        claudeBin,
        [
          "--print",
          "--verbose",
          "--output-format", "stream-json",
          "--max-turns", "10",
          "--allowedTools", "Read,Bash",
          "-",
        ],
        { cwd: outputDir, stdio: ["pipe", "pipe", "pipe"] }
      );

      proc.stdin!.write(fullPrompt);
      proc.stdin!.end();

      let buffer = "";
      let capturedSessionId: string | undefined;
      let fullOutput = "";

      proc.stdout!.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          // Forward all events to the frontend terminal
          emit(line);

          // Capture session_id
          try {
            const event = JSON.parse(line);
            if (event.type === "system" && event.subtype === "init" && event.session_id) {
              capturedSessionId = event.session_id;
            }
            // Capture text output for brief extraction
            // The result event contains the final complete text — prefer it
            if (event.type === "result" && event.result) {
              fullOutput = event.result;
            }
            // Also accumulate from assistant text blocks as fallback
            if (event.type === "assistant" && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === "text" && block.text) {
                  fullOutput += block.text;
                }
              }
            }
          } catch {}
        }
      });

      proc.stderr!.on("data", (chunk: Buffer) => {
        console.error("[creative-director stderr]", chunk.toString());
      });

      proc.on("close", (code) => {
        // Flush remaining buffer — also parse it for brief extraction
        if (buffer.trim()) {
          emit(buffer);
          try {
            const event = JSON.parse(buffer);
            if (event.type === "result" && event.result) {
              fullOutput = event.result;
            }
            if (event.type === "assistant" && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === "text" && block.text) {
                  fullOutput += block.text;
                }
              }
            }
          } catch {}
        }

        console.log("[creative-director] process closed, code:", code, "output length:", fullOutput.length);

        // Try to parse the brief from the output
        let brief: Brief | null = null;

        // Strategy 1: Look for JSON object in the output (may be wrapped in code fence)
        try {
          const jsonMatch = fullOutput.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
          if (jsonMatch) {
            brief = JSON.parse(jsonMatch[1].trim());
          }
        } catch {}

        // Strategy 2: Try to find the outermost JSON object
        if (!brief) {
          try {
            const firstBrace = fullOutput.indexOf("{");
            const lastBrace = fullOutput.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace > firstBrace) {
              brief = JSON.parse(fullOutput.slice(firstBrace, lastBrace + 1));
            }
          } catch {}
        }

        // Strategy 3: Try raw parse
        if (!brief) {
          try {
            brief = JSON.parse(fullOutput.trim());
          } catch {}
        }

        console.log("[creative-director] brief parsed:", !!brief);

        if (brief) {
          // Save brief to disk
          saveBrief(dirName, brief);

          // Save project record
          try {
            const result = db.prepare(
              "INSERT INTO projects (name, site_dir, provider, framework, session_id, github_repo) VALUES (?, ?, ?, ?, ?, ?)"
            ).run(projectName, dirName, "claude", framework, capturedSessionId || null, settings.github_repo || null);

            emit(JSON.stringify({
              type: "done",
              brief,
              siteDir: dirName,
              projectId: result.lastInsertRowid,
              sessionId: capturedSessionId,
            }));
          } catch {
            emit(JSON.stringify({ type: "done", brief, siteDir: dirName, sessionId: capturedSessionId }));
          }
        } else {
          console.error("[creative-director] Failed to parse brief. Output preview:", fullOutput.slice(0, 1000));
          emit(JSON.stringify({
            type: "error",
            message: "Failed to parse brief from Creative Director output. Check server logs.",
            rawOutput: fullOutput.slice(0, 500),
          }));
        }

        // Clean up reference screenshots
        try {
          const refDir = path.join(outputDir, "_reference");
          if (fs.existsSync(refDir)) fs.rmSync(refDir, { recursive: true });
        } catch {}

        close();
      });

      proc.on("error", (err) => {
        emit(JSON.stringify({ type: "error", message: err.message }));
        close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
