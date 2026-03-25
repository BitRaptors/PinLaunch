import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import net from "net";

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
let nextPort = 5173;

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => {
      srv.close(() => resolve(true));
    });
    srv.listen(port, "127.0.0.1");
  });
}

async function allocatePort(): Promise<number> {
  for (let attempts = 0; attempts < 100; attempts++) {
    const port = nextPort++;
    if (await isPortFree(port)) return port;
  }
  throw new Error("Could not find a free port for Vite dev server");
}

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

async function waitForServer(url: string, timeoutMs = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return; // Vite is up
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Vite dev server did not become ready within ${timeoutMs / 1000}s`);
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

  // Allocate port and start Vite
  const port = await allocatePort();
  const url = `http://localhost:${port}`;

  onEvent({ type: "vite-setup", phase: "starting", message: `Starting Vite dev server on port ${port}...` });

  const proc = spawn("npx", ["vite", "--host", "--port", String(port)], {
    cwd: outputDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) {
        onEvent({ type: "vite-setup", phase: "starting-log", message: line.trim() });
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

  const info: ServerInfo = { port, url, process: proc, siteDir };
  servers.set(siteDir, info);

  // Clean up on unexpected exit
  proc.on("close", () => {
    servers.delete(siteDir);
  });

  // Wait for server to be ready
  try {
    await waitForServer(url);
    onEvent({ type: "vite-setup", phase: "ready", message: `Dev server ready at ${url}`, url, port });
  } catch (err: any) {
    stopViteServer(siteDir);
    onEvent({ type: "vite-setup", phase: "error", message: err.message });
    throw err;
  }

  return { port, url };
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
