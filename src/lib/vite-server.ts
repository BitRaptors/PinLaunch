import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

export interface ViteSetupEvent {
  type: "vite-setup";
  phase: "install" | "install-log" | "starting" | "starting-log" | "ready" | "error";
  message: string;
  url?: string;
  port?: number;
}

interface ServerInfo {
  port: number;
  url: string;
  process: ChildProcess;
  siteDir: string;
}

const servers = new Map<string, ServerInfo>();

export function detectViteProject(outputDir: string): boolean {
  const pkgPath = path.join(outputDir, "package.json");
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return !!(pkg.dependencies?.vite || pkg.devDependencies?.vite);
  } catch {
    return false;
  }
}

export function getViteServer(siteDir: string): ServerInfo | undefined {
  return servers.get(siteDir);
}

/** Parse Vite's stdout for the actual local URL (e.g. "➜  Local:   http://localhost:5173/") */
function parseViteUrl(line: string): { url: string; port: number } | null {
  const match = line.match(/Local:\s+(https?:\/\/localhost:(\d+))/);
  if (!match) return null;
  return { url: match[1].replace(/\/$/, ""), port: parseInt(match[2], 10) };
}

function runNpmInstall(
  cwd: string,
  onEvent: (event: ViteSetupEvent) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    onEvent({ type: "vite-setup", phase: "install", message: "Running npm install..." });

    const proc = spawn("npm", ["install"], { cwd, stdio: ["ignore", "pipe", "pipe"] });

    proc.stdout?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        if (line.trim()) {
          onEvent({ type: "vite-setup", phase: "install-log", message: line.trim() });
        }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        if (line.trim()) {
          onEvent({ type: "vite-setup", phase: "install-log", message: line.trim() });
        }
      }
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`npm install exited with code ${code}`));
      } else {
        resolve();
      }
    });

    proc.on("error", reject);
  });
}

export async function startViteServer(
  siteDir: string,
  onEvent: (event: ViteSetupEvent) => void
): Promise<{ port: number; url: string }> {
  // Return existing server if already running
  const existing = servers.get(siteDir);
  if (existing) {
    onEvent({ type: "vite-setup", phase: "ready", message: `Dev server already running at ${existing.url}`, url: existing.url, port: existing.port });
    return { port: existing.port, url: existing.url };
  }

  const outputDir = path.join(process.cwd(), "output", siteDir);

  // npm install
  await runNpmInstall(outputDir, onEvent);

  onEvent({ type: "vite-setup", phase: "starting", message: "Starting Vite dev server..." });

  // Let Vite auto-select a free port — we parse the actual URL from stdout
  const proc = spawn("npx", ["vite", "--host"], {
    cwd: outputDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Wait for Vite to print its local URL to stdout
  const result = await new Promise<{ port: number; url: string }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Vite dev server did not become ready within 60s"));
    }, 60000);

    proc.stdout?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        if (line.trim()) {
          onEvent({ type: "vite-setup", phase: "starting-log", message: line.trim() });
        }
        const parsed = parseViteUrl(line);
        if (parsed) {
          clearTimeout(timeout);
          resolve(parsed);
        }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        if (line.trim()) {
          onEvent({ type: "vite-setup", phase: "starting-log", message: line.trim() });
        }
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Vite exited with code ${code} before becoming ready`));
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  const info: ServerInfo = { port: result.port, url: result.url, process: proc, siteDir };
  servers.set(siteDir, info);

  // Clean up on unexpected exit
  proc.on("close", () => {
    servers.delete(siteDir);
  });

  onEvent({ type: "vite-setup", phase: "ready", message: `Dev server ready at ${result.url}`, url: result.url, port: result.port });
  return result;
}

export function stopViteServer(siteDir: string): void {
  const info = servers.get(siteDir);
  if (!info) return;
  try {
    info.process.kill();
  } catch {}
  servers.delete(siteDir);
}

export function stopAllViteServers(): void {
  for (const [siteDir] of servers) {
    stopViteServer(siteDir);
  }
}

// Cleanup on process exit
function cleanup() {
  stopAllViteServers();
}

process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
