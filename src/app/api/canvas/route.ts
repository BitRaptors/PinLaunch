import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  const db = getDb()

  if (!projectId) {
    // Auto-create or fetch default project
    let project = db.prepare('SELECT id FROM projects ORDER BY id LIMIT 1').get() as { id: number } | undefined
    if (!project) {
      const result = db.prepare(
        'INSERT INTO projects (name, site_dir, provider, framework) VALUES (?, ?, ?, ?)'
      ).run('Default Project', `project-${Date.now()}`, 'gemini', 'html')
      project = { id: result.lastInsertRowid as number }
    }
    const row = db.prepare('SELECT state FROM canvas_state WHERE project_id = ?').get(project.id) as { state: string } | undefined
    if (!row) {
      const defaultState = JSON.stringify({ nodes: [], viewport: { x: 0, y: 0, zoom: 1 } })
      db.prepare('INSERT INTO canvas_state (project_id, state) VALUES (?, ?)').run(project.id, defaultState)
      return NextResponse.json({ projectId: project.id, state: JSON.parse(defaultState) })
    }
    return NextResponse.json({ projectId: project.id, state: JSON.parse(row.state) })
  }

  const row = db.prepare('SELECT state FROM canvas_state WHERE project_id = ?').get(Number(projectId)) as { state: string } | undefined
  if (!row) {
    return NextResponse.json({ error: 'Canvas not found' }, { status: 404 })
  }
  return NextResponse.json({ projectId: Number(projectId), state: JSON.parse(row.state) })
}

export async function PUT(req: NextRequest) {
  const { projectId, state } = await req.json()
  const db = getDb()

  const existing = db.prepare('SELECT id FROM canvas_state WHERE project_id = ?').get(projectId)
  if (existing) {
    db.prepare('UPDATE canvas_state SET state = ?, updated_at = datetime(?) WHERE project_id = ?')
      .run(JSON.stringify(state), new Date().toISOString(), projectId)
  } else {
    db.prepare('INSERT INTO canvas_state (project_id, state) VALUES (?, ?)')
      .run(projectId, JSON.stringify(state))
  }

  return NextResponse.json({ ok: true })
}

// POST handler for navigator.sendBeacon (which always sends POST)
export async function POST(req: NextRequest) {
  return PUT(req)
}
