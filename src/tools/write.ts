import type { ToolDefinition } from "../core/types";

export const writeTool: ToolDefinition = {
  name: "write",
  description:
    "Writes content to a file, creating it if it doesn't exist. Overwrites the entire file if it already exists. Use the edit tool instead if you only want to change part of an existing file.",
  parameters: {
    type: "object",
    properties: {
      filePath: { type: "string" },
      content: { type: "string" },
    },
    required: ["filePath", "content"],
  },
  execute: async (args) => {
    const filePath = args.filePath as string;
    const content = args.content as string;

    try {
      const bytesWritten = await Bun.write(filePath, content);
      return `wrote ${bytesWritten} bytes to ${filePath}`;
    } catch (err) {
      return `failed to write file: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
