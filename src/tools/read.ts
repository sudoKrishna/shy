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
      const file = Bun.file(filePath);
      const exists = await file.exists();
      if (!exists) {
        return `file not found: ${filePath}`;
      }

      const content = await file.text();
      return truncate(content);
    } catch (err) {
      return `failed to read file: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
