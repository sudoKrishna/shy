import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { buildConfig } from "../src/core/config.ts";
import { runLoop } from "../src/core/loop.ts";
import { baseTools, withSubagent } from "../src/tools/index.ts";
import { systemPrompt } from "../src/prompts/system.ts";

interface TaskResult {
    task: string;
    passed: boolean;
    stopReason: string;
    status: "completed" | "incomplete";
    durationMs: number;
    error?: string;
    inputTokens: number;
    outputTokens: number;
}

const FIXTURE_FILES = new Set(["prompt.md", "setup.sh", "check.sh"]);
const projectRoot = process.cwd();

async function cleanTaskDir(taksPath: string): Promise<void> {
    const entries = await readdir(taksPath);
    for (const entry of entries) {
        if (!FIXTURE_FILES.has(entry)) {
            await rm(join(taksPath, entry), { recursive: true, force: true });
        }
    }
}

const tasks = await readdir("evals/tasks", {
    withFileTypes: true
})

const taksFolder = tasks
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)


const config = withSubagent(
    buildConfig({
        systemPrompt,
        tools: baseTools,
    })
);

const results: TaskResult[] = [];

for(const task of taksFolder) {
    const taksPath = join("evals/tasks", task);
    const startedAt = Date.now();

    await cleanTaskDir(taksPath);

    const setupPath = join(taksPath, "setup.sh");

    if(existsSync(setupPath)) {
        execSync(`bash "setup.sh"`, {
            cwd : taksPath,
            stdio : "inherit",
        })
    }

    const promptPath = join(taksPath, "prompt.md");
    const prompt = (await readFile(promptPath, "utf-8")).trim();

    process.chdir(taksPath);
    let stopReason = "error";
    let status: "completed" | "incomplete" = "incomplete";
    let errorMessage: string | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    try {
        const result = await runLoop(prompt, config);
        stopReason = result.stopReason;
        status = result.status;
        inputTokens = result.usage.inputTokens;
        outputTokens = result.usage.outputTokens;
    } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
        process.chdir(projectRoot);
    }

    const checkPath = join(taksPath, "check.sh");
    let passed = false;
    if (existsSync(checkPath)) {
        try {
            execSync(`bash "check.sh"`, {
                cwd: taksPath,
                stdio: "ignore",
            });
            passed = true;
        } catch {
            passed = false;
        }
    }

    const durationMs = Date.now() - startedAt;
    results.push({ task, passed, stopReason, status, durationMs, error: errorMessage, inputTokens, outputTokens });

    // "passed" means the task's objective check passed. "status" records the
    // agent's own completion state; these are intentionally separate signals.
    console.log(`[${passed ? "PASS" : "FAIL"}] ${task} (agent=${status}, stop=${stopReason}, ${durationMs}ms, ${inputTokens}+${outputTokens} tokens)`);
}

const passedCount = results.filter((r) => r.passed).length;
console.log(`\n${passedCount}/${results.length} passed`);

const totalInputTokens = results.reduce((sum, r) => sum + r.inputTokens, 0);
const totalOutputTokens = results.reduce((sum, r) => sum + r.outputTokens, 0);
console.log(`total tokens: ${totalInputTokens} in / ${totalOutputTokens} out`);

const failed = results.filter((r) => !r.passed);
if (failed.length) {
    console.log("failed tasks:", failed.map((r) => r.task).join(", "));
}

const resultsPath = join(
    "evals/results",
    `${new Date().toISOString().replace(/[:.]/g, "-")}.json`
);
await Bun.write(resultsPath, JSON.stringify(results, null, 2));
