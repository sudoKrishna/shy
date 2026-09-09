import { runLoop } from "../core/loop";
import type { AgentConfig, ToolDefinition } from "../core/types";

const MAX_RESULT_LENGTH = 3000;
const MAX_SUBAGENT_SPAWNS = 5;

const SUBAGENT_SYSTEM_PROMPT =
  "You are a focused sub-agent completing one specific, narrow step of a larger task. " +
  "You do not see the parent conversation — only the task description given to you below. " +
  "Work efficiently, use the tools available, and finish with a short, direct summary of what " +
  "you did and found. Do not ask clarifying questions — make a reasonable assumption and note " +
  "it briefly if something is ambiguous.";

function truncate(text: string): string {
  if (text.length <= MAX_RESULT_LENGTH) return text;
  return text.slice(0, MAX_RESULT_LENGTH) + "\n...(truncated)";
}

export function createSpawnSubagentTool(parentConfig: AgentConfig): ToolDefinition {
  const subagentTools = parentConfig.tools.filter((t) => t.name !== "spawn_subagent");

  let spawnCount = 0;

  return {
    name: "spawn_subagent",
    description:
      "Delegates a focused, independent sub-task to a fresh agent with its own clean context. " +
      "Use this when a task has separable steps (e.g. 'find where the bug is' vs 'fix the bug') " +
      "so each step gets its own context instead of piling into the main conversation. Do not " +
      "use this for simple, single-step actions — call the relevant tool directly instead.",
    parameters: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description:
            "A clear, self-contained description of the sub-task. Include any file names or " +
            "details the sub-agent needs — it has no access to this conversation.",
        },
        context: {
          type: "string",
          description:
            "Optional extra background the sub-agent needs, e.g. findings from a previous step.",
        },
      },
      required: ["task"],
    },
    execute: async (args) => {
      if (spawnCount >= MAX_SUBAGENT_SPAWNS) {
        return `sub-agent limit reached (${MAX_SUBAGENT_SPAWNS} per run) — continue directly with the available tools instead of delegating further.`;
      }
      spawnCount++;

      const task = args.task as string;
      const context = args.context as string | undefined;

      const subConfig: AgentConfig = {
        ...parentConfig,
        systemPrompt: SUBAGENT_SYSTEM_PROMPT,
        tools: subagentTools,
        maxIterations: Math.max(5, Math.floor(parentConfig.maxIterations / 2)),
      };

      const fullTask = context ? `${task}\n\nContext from the parent task:\n${context}` : task;

      try {
        const result = await runLoop(fullTask, subConfig);
        return truncate(
          result.finalContent ||
            `(sub-agent stopped: ${result.stopReason}, produced no final message)`
        );
      } catch (err) {
        return `sub-agent failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  };
}
