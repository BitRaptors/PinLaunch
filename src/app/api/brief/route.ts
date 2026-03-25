import { loadBrief } from "@/lib/brief";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const siteDir = req.nextUrl.searchParams.get("siteDir");
  if (!siteDir) {
    return NextResponse.json({ error: "siteDir is required" }, { status: 400 });
  }

  const brief = loadBrief(siteDir);
  if (!brief) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }

  return NextResponse.json(brief);
}
