import { buildConfig } from "../../src/core/config";
import { runLoop } from "../../src/core/loop";
import { baseTools, withSubagent } from "../../src/tools/index";
import { systemPrompt } from "../../src/prompts/system";
import { traceEmitter } from "../../src/trace/emitter";
import type { AgentConfig, TraceEvent } from "../../src/core/types";

const baseConfig = buildConfig({ systemPrompt, tools: baseTools });

export const agentConfig = withSubagent(baseConfig);

// per-request configs (e.g. with a user-supplied apiKey) need their own
// spawn_subagent tool rebuilt on top of that override, not the server's.
export function buildRunConfig(overrides: Partial<AgentConfig>): AgentConfig {
  return withSubagent({ ...baseConfig, ...overrides });
}

export { runLoop, traceEmitter };
export type { TraceEvent };
