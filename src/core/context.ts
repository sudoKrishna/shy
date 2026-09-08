import { callModel } from "./llm";
import type { AgentConfig, Message } from "./types";

const CHARS_PER_TOKEN = 4;
const KEEP_RECENT = 6;
const SUMMARY_MAX_OUTPUT_TOKENS = 500;

const SUMMARY_SYSTEM_PROMPT =
  "You are compressing an AI coding agent's progress so far into a short, dense brief. " +
  "Keep: what the task is, what has been done, what files were changed, and the current state. " +
  "Drop: raw tool call arguments, full command output, and anything not needed to continue the task. " +
  "Write it as plain prose, a few sentences.";

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateMessageTokens(messages: Message[]): number {
  let total = 0;
  for (const m of messages) {
    total += estimateTokens(m.content);
    if (m.toolCalls?.length) {
      total += estimateTokens(JSON.stringify(m.toolCalls));
    }
  }
  return total;
}

export function shouldCompact(messages: Message[], config: AgentConfig): boolean {
  const estimated = estimateMessageTokens(messages);
  return estimated > config.maxContextTokens * config.compactionThreshold;
}

function flattenForSummary(messages: Message[]): string {
  return messages
    .map((m) => {
      const label = m.name ? `${m.role} (${m.name})` : m.role;
      return `[${label}]: ${m.content}`;
    })
    .join("\n\n");
}

export async function compactMessages(
  messages: Message[],
  config: AgentConfig
): Promise<{ messages: Message[]; beforeCount: number; afterCount: number }> {
  const beforeCount = messages.length;

  if (messages.length <= KEEP_RECENT + 1) {
    return { messages, beforeCount, afterCount: beforeCount };
  }

  const systemMsg = messages[0]!;
  const recent = messages.slice(-KEEP_RECENT);
  const older = messages.slice(1, messages.length - KEEP_RECENT);

  if (older.length === 0) {
    return { messages, beforeCount, afterCount: beforeCount };
  }

  const summaryConfig: AgentConfig = {
    ...config,
    tools: [],
    maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
  };

  const summaryResponse = await callModel(
    [
      { role: "system", content: SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: flattenForSummary(older) },
    ],
    summaryConfig
  );

  const summaryMessage: Message = {
    role: "user",
    content: `[Summary of earlier progress]\n${summaryResponse.content ?? ""}`,
  };

  const compacted = [systemMsg, summaryMessage, ...recent];
  return { messages: compacted, beforeCount, afterCount: compacted.length };
}
