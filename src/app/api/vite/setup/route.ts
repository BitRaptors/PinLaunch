import { startViteServer } from "@/lib/vite-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { siteDir } = await req.json();

  if (!siteDir) {
    return NextResponse.json({ error: "siteDir is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

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
        const server = await startViteServer(siteDir, (event) => {
          emit(JSON.stringify(event));
        });

        emit(JSON.stringify({
          type: "done",
          previewUrl: server.url,
          port: server.port,
          isVite: true,
        }));
      } catch (err: any) {
        emit(JSON.stringify({
          type: "vite-setup",
          phase: "error",
          message: `Dev server failed: ${err.message}`,
        }));
        emit(JSON.stringify({
          type: "done",
          previewUrl: null,
          isVite: false,
        }));
      }

      close();
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
