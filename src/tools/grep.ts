import { spawn } from "node:child_process";
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
  execute: (args) => {
    const pattern = args.pattern as string;
    const path = (args.path as string | undefined) ?? ".";

    return new Promise((resolve) => {
      const proc = spawn("grep", ["-rn", "--exclude-dir=node_modules", "--exclude-dir=.git", pattern, path]);
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill();
      }, TIMEOUT_MS);

      proc.stdout.on("data", (chunk) => (stdout += chunk));
      proc.stderr.on("data", (chunk) => (stderr += chunk));

      proc.on("error", (err) => {
        clearTimeout(timer);
        resolve(`failed to run grep: ${err.message}`);
      });

      proc.on("close", (exitCode) => {
        clearTimeout(timer);

        if (timedOut) {
          resolve(`grep timed out after ${TIMEOUT_MS / 1000}s`);
          return;
        }
        if (exitCode === 1 && stdout.length === 0) {
          resolve("no matches found");
          return;
        }
        if ((exitCode ?? 0) > 1) {
          resolve(`grep failed: ${stderr}`);
          return;
        }

        resolve(truncate(stdout));
      });
    });
  },
};
