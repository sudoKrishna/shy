import { readFile } from "node:fs/promises";
import type { ToolDefinition } from "../core/types";

const MAX_OUTPUT_LENGTH = 5000;

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_LENGTH) return text;
  return text.slice(0, MAX_OUTPUT_LENGTH) + "\n...(truncated)";
}

export const readTool: ToolDefinition = {
  name: "read",
  description: "Reads the contents of a file and returns it as text",
  parameters: {
    type: "object",
    properties: {
      filePath: { type: "string" },
    },
    required: ["filePath"],
  },
  execute: async (args) => {
    const filePath = args.filePath as string;

    try {
      const content = await readFile(filePath, "utf-8");
      return truncate(content);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return `file not found: ${filePath}`;
      }
      return `failed to read file: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
