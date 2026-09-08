import { spawn } from "node:child_process";
import type { ToolDefinition } from "../core/types";

const MAX_OUTPUT_LENGTH = 5000;
const TIMEOUT_MS = 30000;

function truncate(text: string) {
    if (text.length <= MAX_OUTPUT_LENGTH) return text;
    return text.slice(0, MAX_OUTPUT_LENGTH) + "\n...(truncate)";
}

export const bashTool: ToolDefinition = {
    name: "bash",
    description: "Runs a shell command and returns stdout, stderr, and exit code",
    parameters: {
        type: "object",
        properties: {
            command: { type: "string" },
        },
        required: ["command"],
    },
    execute: (args) => {
        const command = args.command as string;
        const timeoutSeconds = Math.ceil(TIMEOUT_MS / 1000);

        return new Promise((resolve) => {
            const proc = spawn("timeout", ["-k", "1", `${timeoutSeconds}`, "sh", "-c", command]);
            let stdout = "";
            let stderr = "";

            proc.stdout.on("data", (chunk) => (stdout += chunk));
            proc.stderr.on("data", (chunk) => (stderr += chunk));

            proc.on("error", (err) => {
                resolve(`failed to run command: ${err.message}`);
            });

            proc.on("close", (exitCode) => {
                if (exitCode === 124) {
                    resolve(`command timed out after ${timeoutSeconds}s\nstdout:\n${truncate(stdout)}\nstderr:\n${truncate(stderr)}`);
                    return;
                }
                resolve(`exit code: ${exitCode}\nstdout:\n${truncate(stdout)}\nstderr:\n${truncate(stderr)}`);
            });
        });
    },
};
