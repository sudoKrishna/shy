import type { ToolDefinition } from "../core/types";

const MAX_OUTPUT_LENGTH = 5000;
const TIMEOUT_MS = 30000;

function truncate(text : string) {
    if(text.length <= MAX_OUTPUT_LENGTH) return text;
    return text.slice(0, MAX_OUTPUT_LENGTH) + "\n...(truncate)"
}

export const bashTool : ToolDefinition = {
    name : "bash",
    description : "Runs a sell command and returns stdout , stderr , and exit code",
    parameters : {
       type : "object",
       properties : {
        command : {type : "string"},
       },
       required : ["command"],
    },
    execute : async (args) => {
        const command = args.command as string;
        const timeoutSeconds = Math.ceil(TIMEOUT_MS / 1000);

        const proc = Bun.spawn(["timeout", "-k", "1", `${timeoutSeconds}`, "sh", "-c", command], {
            stdout : "pipe",
            stderr : "pipe",
        });

        try {
            const exitCode = await proc.exited;
            const stdout = await new Response(proc.stdout).text();
            const stderr = await new Response(proc.stderr).text();

            if (exitCode === 124) {
                return `command timed out after ${timeoutSeconds}s\nstdout:\n${truncate(stdout)}\nstderr:\n${truncate(stderr)}`;
            }

            return `exit code: ${exitCode}\nstdout:\n${truncate(stdout)}\nstderr:\n${truncate(stderr)}`;
        } catch (err : any) {
                    return `failed to run command: ${err instanceof Error ? err.message : String(err)}`;

        }
    },
};