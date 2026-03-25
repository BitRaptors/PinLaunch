import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads')

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const params = await context.params
  const filename = params.filename

  // Directory traversal protection: ensure resolved path stays within UPLOADS_DIR
  const filepath = path.resolve(path.join(UPLOADS_DIR, filename))
  if (!filepath.startsWith(UPLOADS_DIR)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  try {
    const buffer = await readFile(filepath)

    // Determine Content-Type based on file extension
    const ext = path.extname(filename).toLowerCase()
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    }
    const contentType = contentTypeMap[ext] || 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year since filenames include timestamps
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
