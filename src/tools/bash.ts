import { spawn } from "node:child_process";
import type { ToolDefinition } from "../core/types";

const MAX_OUTPUT_LENGTH = 5000;
const TIMEOUT_MS = 30000;
const riskyCommandPatterns: RegExp[] = [
    // Destructive filesystem / disk operations — only when the target is
    // exactly the root, home, cwd, parent dir, or a bare wildcard (not any
    // path that merely starts with "/", "~", ".", etc.)
    /\brm\s+(?:-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*|--recursive(?:\s+--force)?)\s+(?:\/|~|\*|\.{1,2})\/?(?=\s|;|&|\||$)/i,
    /\bmkfs(?:\.[a-z0-9_-]+)?\b/i,
    /\bdd\b(?=[\s\S]*\bof\s*=\s*\/dev\/)/i,

    // Fork bomb
    /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,

    // Common infinite loops
    /\bwhile\s*\(\s*(?:true|:|\[\s*\])\s*\)\s*;\s*do\b/i,
    /\bwhile\s+true\s*;?\s*do\b/i,

    // Remote script execution
    /\b(?:curl|wget)\b[\s\S]*\|\s*(?:sh|bash|zsh|ksh|fish)\b/i,

    // Recursive permission changes
    /\bchmod\s+(?:-[a-zA-Z]*R[a-zA-Z]*\s+)?(?:777|a+rwx)\s+(?:\/|~|\*)/i,
];

function truncate(text: string) {
    if (text.length <= MAX_OUTPUT_LENGTH) return text;
    return text.slice(0, MAX_OUTPUT_LENGTH) + "\n...(truncate)";
}

function isRiskyCommand(command : string) : boolean {
    return riskyCommandPatterns.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(command)
    })
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
    execute: async (args) => {
        const command = args.command as string;

        if (isRiskyCommand(command)) {
            return "blocked: this command looks destructive or unsafe and was not executed";
        }
        const timeoutSeconds = Math.ceil(TIMEOUT_MS / 1000);

        return new Promise((resolve) => {
            const proc = spawn("timeout", ["-k", "1", `${timeoutSeconds}`, "sh", "-c", command]);
            let stdout = "";
            let stderr = "";

            proc.stdout.on("data", (chunk) => (stdout += chunk));
            proc.stderr.on("data", (chunk) => (stderr += chunk));

            proc.on("error", (err : any) => {
                resolve(`failed to run command: ${err.message}`);
            });

            proc.on("close", (exitCode : any) => {
                if (exitCode === 124) {
                    resolve(`command timed out after ${timeoutSeconds}s\nstdout:\n${truncate(stdout)}\nstderr:\n${truncate(stderr)}`);
                    return;
                }
                resolve(`exit code: ${exitCode}\nstdout:\n${truncate(stdout)}\nstderr:\n${truncate(stderr)}`);
            });
        });
    },
};
