import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
  const { siteDir } = await req.json();

  if (!siteDir) {
    return NextResponse.json({ error: "siteDir is required" }, { status: 400 });
  }

  const outputDir = path.join(process.cwd(), "output", siteDir);
  const resolved = path.resolve(outputDir);

  // Directory traversal protection
  if (!resolved.startsWith(path.resolve(process.cwd(), "output"))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "Directory not found" }, { status: 404 });
  }

  const platform = process.platform;
  let command: string;

  if (platform === "darwin") {
    command = `open "${resolved}"`;
  } else if (platform === "win32") {
    command = `explorer "${resolved}"`;
  } else {
    command = `xdg-open "${resolved}"`;
  }

  return new Promise<NextResponse>((resolve) => {
    exec(command, (err) => {
      if (err) {
        // explorer.exe returns exit code 1 even on success on Windows
        if (platform === "win32") {
          resolve(NextResponse.json({ ok: true }));
        } else {
          resolve(NextResponse.json({ error: "Failed to open folder" }, { status: 500 }));
        }
      } else {
        resolve(NextResponse.json({ ok: true }));
      }
    });
  });
}
