import { callLLM } from "./llm.js";
import { SYSTEM_PROMPT } from "./prompts/systemPrompt.js";
import type { Message, ToolDefinition, ToolResult } from "./types.js";
import { readFileTool, runReadFile } from "./tools/readFile.js";
import { listFilesTool, runListFile } from "./tools/listFiles.js";
import { runCommandTool, runRunCommand } from "./tools/runCommand.js";


const ALL_TOOLS: ToolDefinition[] = [
  readFileTool,
  listFilesTool,
  runCommandTool,
];
export async function runAgent(userMessage: string): Promise<string> {



  const messages: Message[] = [
    { role: "user", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];


  while (true) {

    const response = await callLLM(messages, ALL_TOOLS);

    if (response.type === "text") {
      return response.content;
    }

    const toolResults: ToolResult[] = [];

    for (const toolCall of response.toolCalls) {

      console.log(`\n[Agent] Using tool: ${toolCall.name}`);
      console.log(`[Agent] With input:`, toolCall.input);

      let result: string;

      if (toolCall.name === "readFile") {
        result = await runReadFile(toolCall.input);
      } else if (toolCall.name === "listFiles") {
        result = await runListFile(toolCall.input);
      } else if (toolCall.name === "runCommand") {
        result = await runRunCommand(toolCall.input);
      } else {
        result = `Error: Unknown tool "${toolCall.name}"`;
      }

      console.log(`[Agent] Tool result: ${result.slice(0, 100)}...`);

      toolResults.push({
        toolCallId: toolCall.id,
        content: result,
      });
    }

    messages.push({
      role: "assistant",
      content: JSON.stringify(response.toolCalls),
    });
    for (const result of toolResults) {
      messages.push({
        role: "tool",
        content: result.content,
        tool_call_id : result.toolCallId,
      });
    }
  }
}