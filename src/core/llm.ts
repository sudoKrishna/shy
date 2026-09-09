import OpenAI from "openai";
import { DEFAULT_BASE_URL } from "./config.ts";
import type {
  AgentConfig,
  Message,
  ModelResponse,
  ToolCall,
  ToolDefinition,
} from "./types.ts";

const clients = new Map<string, OpenAI>();

function getClient(config: AgentConfig): OpenAI {
  if (!config.apiKey) {
    throw new Error(
      "No DeepSeek API key configured. Set DEEPSEEK_API_KEY, or pass apiKey in AgentConfig."
    );
  }

  const baseURL = config.baseURL ?? DEFAULT_BASE_URL;
  const cacheKey = `${config.apiKey}::${baseURL}`;

  let client = clients.get(cacheKey);
  if (!client) {
    client = new OpenAI({ apiKey: config.apiKey, baseURL });
    clients.set(cacheKey, client);
  }
  return client;
}

function toApiMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool",
        content: m.content,
        tool_call_id: m.toolCallId ?? "",
      };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

function toApiTools(tools: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function mapStopReason(reason: string): ModelResponse["stopReason"] {
  if (reason === "tool_calls") return "tool_calls";
  if (reason === "length") return "length";
  if (reason === "stop") return "stop";
  return "error";
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

function isRetryable(err: unknown): boolean {
  if (err instanceof OpenAI.APIConnectionError || err instanceof OpenAI.APIConnectionTimeoutError) {
    return true;
  }
  if (err instanceof OpenAI.APIError && typeof err.status === "number") {
    return err.status === 429 || err.status >= 500;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callModel(
  messages: Message[],
  config: AgentConfig
): Promise<ModelResponse> {
  const client = getClient(config);
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: config.model,
        messages: toApiMessages(messages),
        tools: config.tools.length ? toApiTools(config.tools) : undefined,
        max_tokens: config.maxOutputTokens,
        temperature: config.temperature,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error("Model returned no choices");
      }

      const rawToolCalls = choice.message.tool_calls ?? [];
      const toolCalls: ToolCall[] = rawToolCalls
        .filter((tc): tc is OpenAI.Chat.ChatCompletionMessageFunctionToolCall => tc.type === "function")
        .map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: safeParseArgs(tc.function.arguments),
        }));

      return {
        content: choice.message.content,
        toolCalls,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
        stopReason: mapStopReason(choice.finish_reason),
      };
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES || !isRetryable(err)) {
        throw err;
      }
      const delayMs = BASE_DELAY_MS * 2 ** attempt;
      console.error(`callModel attempt ${attempt + 1} failed, retrying in ${delayMs}ms:`, err instanceof Error ? err.message : err);
      await sleep(delayMs);
    }
  }

  throw lastErr;
}
