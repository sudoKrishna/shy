import { readFile, writeFile } from "node:fs/promises";
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
      let content: string;
      try {
        content = await readFile(filePath, "utf-8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          return `file not found: ${filePath}`;
        }
        throw err;
      }

      const occurrences = content.split(oldString).length - 1;

      if (occurrences === 0) {
        return `oldString not found in ${filePath}`;
      }
      if (occurrences > 1) {
        return `oldString matches ${occurrences} times in ${filePath}, must match exactly once. Add more surrounding context to make it unique.`;
      }

      const updated = content.replace(oldString, newString);
      await writeFile(filePath, updated, "utf-8");

      return `edited ${filePath}`;
    } catch (err) {
      return `failed to edit file: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
