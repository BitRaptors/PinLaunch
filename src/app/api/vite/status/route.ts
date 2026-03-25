import { getViteServer } from "@/lib/vite-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const siteDir = req.nextUrl.searchParams.get("siteDir");

  if (!siteDir) {
    return NextResponse.json({ error: "siteDir is required" }, { status: 400 });
  }

  const server = getViteServer(siteDir);

  if (server) {
    return NextResponse.json({ running: true, url: server.url, port: server.port });
  }

  return NextResponse.json({ running: false });
}
