import { agentConfig, buildRunConfig, runLoop, traceEmitter, type TraceEvent } from "../../../lib/agent";

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const task = String((body as { task?: unknown }).task ?? "").trim();
  const apiKey = String((body as { apiKey?: unknown }).apiKey ?? "").trim() || agentConfig.apiKey;

  if (!task) {
    return new Response("task is required", { status: 400 });
  }
  if (!apiKey) {
    return new Response("apiKey is required", { status: 400 });
  }

  const runConfig = buildRunConfig({ apiKey });

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const onTrace = (evt: TraceEvent) => {
        controller.enqueue(encoder.encode(sseFrame("trace", evt)));
      };

      traceEmitter.on("event", onTrace);

      runLoop(task, runConfig)
        .then((result) => {
          controller.enqueue(encoder.encode(sseFrame("done", result)));
        })
        .catch((err) => {
          controller.enqueue(
            encoder.encode(
              sseFrame("error", {
                message: err instanceof Error ? err.message : String(err),
              })
            )
          );
        })
        .finally(() => {
          traceEmitter.off("event", onTrace);
          controller.close();
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
