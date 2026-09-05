import type { ToolDefinition } from "../core/types";

export const editTool: ToolDefinition = {
  name: "edit",
  description:
    "Replaces an exact string match inside an existing file with new text. The oldString must match exactly once in the file, including whitespace. Use this instead of write when changing part of an existing file.",
  parameters: {
    type: "object",
    properties: {
      filePath: { type: "string" },
      oldString: { type: "string" },
      newString: { type: "string" },
    },
    required: ["filePath", "oldString", "newString"],
  },
  execute: async (args) => {
    const filePath = args.filePath as string;
    const oldString = args.oldString as string;
    const newString = args.newString as string;

    try {
      const file = Bun.file(filePath);
      const exists = await file.exists();
      if (!exists) {
        return `file not found: ${filePath}`;
      }

      const content = await file.text();
      const occurrences = content.split(oldString).length - 1;

      if (occurrences === 0) {
        return `oldString not found in ${filePath}`;
      }
      if (occurrences > 1) {
        return `oldString matches ${occurrences} times in ${filePath}, must match exactly once. Add more surrounding context to make it unique.`;
      }

      const updated = content.replace(oldString, newString);
      await Bun.write(filePath, updated);

      return `edited ${filePath}`;
    } catch (err) {
      return `failed to edit file: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
