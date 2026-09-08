import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { TraceEvent } from "../core/types";
import { traceEmitter } from "./emitter";

const projectRoot = process.cwd();
const logDir = join(projectRoot, "logs");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const logFilePath = join(logDir, `run-${runId}.jsonl`);

async function ensureLogDir(): Promise<void> {
  await mkdir(logDir, { recursive: true });
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

  traceEmitter.emit("event", event);

  try {
    await ensureLogDir();
    await appendFile(logFilePath, line);
  } catch (err) {
    console.error("failed to write trace log:", err);
  }
}
