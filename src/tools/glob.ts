import { readdir } from "node:fs/promises";
import type { ToolDefinition } from "../core/types";

const IGNORED_DIR_SEGMENTS = ["node_modules", ".git"];
const MAX_RESULTS = 200;

function isIgnored(relativePath: string): boolean {
  const segments = relativePath.split("/");
  return segments.some((seg) => IGNORED_DIR_SEGMENTS.includes(seg));
}

function globToRegExp(pattern: string): RegExp {
  let regexStr = "";

  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];

    if (c === "*" && pattern[i + 1] === "*") {
      regexStr += ".*";
      i++; 
      if (pattern[i + 1] === "/") i++;
    } else if (c === "*") {
      regexStr += "[^/]*";
    } else if (c === "?") {
      regexStr += "[^/]";
    } else if (".+^${}()|[]\\".includes(c!)) {
      regexStr += "\\" + c;
    } else {
      regexStr += c;
    }
  }

  return new RegExp(`^${regexStr}$`);
}

export const globTool: ToolDefinition = {
  name: "glob",
  description:
    "Lists file paths under a directory matching a glob pattern (e.g. \"**/*.py\", \"src/**/test_*.ts\"). " +
    "Returns filenames only, not file contents — use read to see inside a matched file. " +
    "Skips node_modules and .git automatically.",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Glob pattern to match, e.g. \"**/*.py\" or \"*.md\".",
      },
      path: {
        type: "string",
        description: "Directory to search from. Defaults to the current directory.",
      },
    },
    required: ["pattern"],
  },
  execute: async (args) => {
    const pattern = args.pattern as string;
    const path = (args.path as string | undefined) ?? ".";

    let entries;
    try {
      entries = await readdir(path, { withFileTypes: true, recursive: true });
    } catch (err) {
      return `failed to list directory: ${err instanceof Error ? err.message : String(err)}`;
    }

    const regex = globToRegExp(pattern);
    const matches: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const parentPath = (entry as { parentPath?: string; path?: string }).parentPath ?? (entry as { path?: string }).path ?? "";
      const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      const prefix = `${path}/`;
      const relativePath = path !== "." && fullPath.startsWith(prefix) ? fullPath.slice(prefix.length) : fullPath;

      if (isIgnored(relativePath)) continue;
      if (!regex.test(relativePath)) continue;

      matches.push(relativePath);
    }

    if (matches.length === 0) {
      return `no files matched pattern: ${pattern}`;
    }

    if (matches.length > MAX_RESULTS) {
      const shown = matches.slice(0, MAX_RESULTS);
      return `${shown.join("\n")}\n...and ${matches.length - MAX_RESULTS} more (${matches.length} total)`;
    }

    return matches.join("\n");
  },
};
