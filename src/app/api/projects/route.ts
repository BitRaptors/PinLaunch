import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET() {
  const db = getDb();
  const projects = db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all();
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const { name, siteDir, provider, framework, sessionId, githubRepo } = await req.json();

  if (!name || !siteDir || !provider) {
    return NextResponse.json({ error: "name, siteDir, and provider are required" }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(
    "INSERT INTO projects (name, site_dir, provider, framework, session_id, github_repo) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(name, siteDir, provider, framework || null, sessionId || null, githubRepo || null);

  return NextResponse.json({ id: result.lastInsertRowid });
}

export async function PUT(req: NextRequest) {
  const { id, name } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const db = getDb();

  if (name !== undefined) {
    db.prepare("UPDATE projects SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, id);
  } else {
    db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const db = getDb();
  const project = db.prepare("SELECT site_dir FROM projects WHERE id = ?").get(id) as { site_dir: string } | undefined;

  if (project) {
    // Delete the output directory
    const outputDir = path.join(process.cwd(), "output", project.site_dir);
    try {
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
      }
    } catch {}

    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  }

  return NextResponse.json({ ok: true });
}
