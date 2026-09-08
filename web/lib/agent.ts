import { buildConfig } from "../../src/core/config";
import { runLoop } from "../../src/core/loop";
import { allTools } from "../../src/tools/index";
import { systemPrompt } from "../../src/prompts/system";
import { traceEmitter } from "../../src/trace/emitter";
import type { TraceEvent } from "../../src/core/types";

export const agentConfig = buildConfig({ systemPrompt, tools: allTools });

export { runLoop, traceEmitter };
export type { TraceEvent };
