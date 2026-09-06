import { appendFile, mkdir } from "node:fs/promises";
import type { TraceEvent } from "../core/types";

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const logFilePath = `logs/run-${runId}.jsonl`;

async function ensureLogDir(): Promise<void> {
  await mkdir("logs", { recursive: true });
}

export async function logEvent(
  type: TraceEvent["type"],
  iteration: number,
  data: Record<string, unknown>
): Promise<void> {
  const event: TraceEvent = {
    timestamp: new Date().toISOString(),
    type,
    iteration,
    data,
  };

  const line = JSON.stringify(event) + "\n";

  try {
    await ensureLogDir();
    await appendFile(logFilePath, line);
  } catch (err) {
    console.error("failed to write trace log:", err);
  }
}
