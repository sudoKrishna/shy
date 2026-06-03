import OpenAI from "openai";
import type { Message, ToolDefinition, LLMResponse, ToolCall } from "./types.js";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

export async function callLLM(
  messages: Message[],
  tools: ToolDefinition[]
): Promise<LLMResponse> {
  const response = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: messages.map((m) =>
      m.role === "tool"
        ? {
            role: "tool" as const,
            content: m.content,
            tool_call_id: m.tool_call_id,
          }
        : {
            role: m.role,
            content: m.content,
          }
    ),
    tools: tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    })),
    tool_choice: "auto",
  });

  const choice = response.choices[0];

  if(!choice) {
    throw new Error("no response choices returned")
  }
  if (
    choice.finish_reason === "tool_calls" &&
    choice.message.tool_calls &&
    choice.message.tool_calls.length > 0
  ) {
    const toolCalls: ToolCall[] = choice.message.tool_calls.filter((tc) => tc.type === "function").map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments),
    }));

    return {
      type: "tool_use",
      toolCalls,
    };
  }

  return {
    type: "text",
    content: choice.message.content ?? "",
  };
}