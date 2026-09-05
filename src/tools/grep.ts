import type { ToolDefinition } from "../core/types";

const MAX_OUTPUT_LENGTH = 5000;
const TIMEOUT_MS = 10000;

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_LENGTH) return text;
  return text.slice(0, MAX_OUTPUT_LENGTH) + "\n...(truncated)";
}

export const grepTool: ToolDefinition = {
  name: "grep",
  description:
    "Searches for a text pattern inside files under the given path and returns matching lines with file names and line numbers.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string" },
      path: { type: "string", description: "File or directory to search in. Defaults to the current directory." },
    },
    required: ["pattern"],
  },
  execute: async (args) => {
    const pattern = args.pattern as string;
    const path = (args.path as string | undefined) ?? ".";

    const proc = Bun.spawn(
      ["grep", "-rn", "--exclude-dir=node_modules", "--exclude-dir=.git", pattern, path],
      { stdout: "pipe", stderr: "pipe" }
    );

    const timeout = setTimeout(() => {
      proc.kill();
    }, TIMEOUT_MS);

    try {
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();

      if (exitCode === 1 && stdout.length === 0) {
        return "no matches found";
      }
      if (exitCode > 1) {
        return `grep failed: ${stderr}`;
      }

      return truncate(stdout);
    } catch (err) {
      return `failed to run grep: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      clearTimeout(timeout);
    }
  },
};
