import { logEvent } from "../trace/logger";
import { callModel } from "./llm";
import { shouldCompact, compactMessages } from "./context";
import { askJev, getNoulProbability } from "./jev";
import type { AgentConfig, Message, ToolCall, ToolDefinition, ToolResult } from "./types";

const MAX_PARALLEL_TOOLS = 4;

type Access = "read" | "write" | "exclusive";
type ScheduledCall = { call: ToolCall; tool?: ToolDefinition; index: number; access: Access; resource: string };

function classifyTool(call: ToolCall, tool?: ToolDefinition): Pick<ScheduledCall, "access" | "resource"> {
    // Only explicitly recognized tools receive optimistic concurrency. Unknown tools and
    // shell commands may have arbitrary side effects, so they run alone.
    if (!tool) return { access: "exclusive", resource: "*" };

    if (call.name === "web_fetch") return { access: "read", resource: `web:${String(call.arguments.url ?? "")}` };
    if (call.name === "read") return { access: "read", resource: `file:${String(call.arguments.filePath ?? "")}` };
    if (call.name === "write" || call.name === "edit") {
        return { access: "write", resource: `file:${String(call.arguments.filePath ?? "")}` };
    }
    // grep/glob can inspect the whole workspace, so don't run them alongside mutations.
    if (call.name === "grep" || call.name === "glob") return { access: "read", resource: "workspace:*" };
    return { access: "exclusive", resource: "*" };
}

function conflicts(a: ScheduledCall, b: ScheduledCall): boolean {
    if (a.access === "exclusive" || b.access === "exclusive") return true;
    if (a.resource === "workspace:*" || b.resource === "workspace:*") {
        return a.access === "write" || b.access === "write";
    }
    return a.resource === b.resource && (a.access === "write" || b.access === "write");
}

async function executeOne(item: ScheduledCall): Promise<{ call: ToolCall; result: ToolResult }> {
    const { call, tool } = item;
    const startedAt = Date.now();
    let result: ToolResult;

    if (!tool) {
        result = {
            toolCallId: call.id, name: call.name, content: `no such tool: ${call.name}`,
            isError: true, durationMs: Date.now() - startedAt,
        };
    } else {
        try {
            const output = await tool.execute(call.arguments);
            result = {
                toolCallId: call.id, name: call.name, content: output,
                // Current tool contract returns strings for both success and many errors.
                // Preserve existing behavior; tool-level typed errors are a separate improvement.
                isError: false, durationMs: Date.now() - startedAt,
            };
        } catch (error) {
            result = {
                toolCallId: call.id, name: call.name,
                content: error instanceof Error ? error.message : String(error),
                isError: true, durationMs: Date.now() - startedAt,
            };
        }
    }
    return { call, result };
}

async function executeToolCalls(calls: ToolCall[], config: AgentConfig) {
    const pending: ScheduledCall[] = calls.map((call, index) => {
        const tool = config.tools.find((candidate) => candidate.name === call.name);
        return { call, tool, index, ...classifyTool(call, tool) };
    });
    const completed = new Map<number, { call: ToolCall; result: ToolResult }>();

    while (pending.length) {
        const wave: ScheduledCall[] = [];
        for (let i = 0; i < pending.length && wave.length < MAX_PARALLEL_TOOLS;) {
            const candidate = pending[i]!;
            if (wave.every((selected) => !conflicts(selected, candidate))) {
                wave.push(candidate);
                pending.splice(i, 1);
                // Exclusive operations must execute alone.
                if (candidate.access === "exclusive") break;
            } else {
                i++;
            }
        }

        // At least one item is always eligible because the first pending item starts a wave.
        const results = await Promise.all(wave.map(executeOne));
        for (const entry of results) {
            const item = wave.find((scheduled) => scheduled.call.id === entry.call.id);
            if (item) completed.set(item.index, entry);
        }
    }

    return calls.map((_, index) => completed.get(index)!);
}

export async function runLoop(userInput: string, config: AgentConfig) {
    let message: Message[] = [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: userInput },
    ];

    await logEvent("loop_start", 0, { userInput });
    let iteration = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    while (iteration < config.maxIterations) {
        if (shouldCompact(message, config)) {
            const { messages: compacted, beforeCount, afterCount } = await compactMessages(message, config);
            message = compacted;
            await logEvent("context_compacted", iteration, { beforeCount, afterCount });
        }

        const response = await callModel(message, config);
        totalInputTokens += response.usage.inputTokens;
        totalOutputTokens += response.usage.outputTokens;

        await logEvent("model_calls", iteration, {
            stopReason: response.stopReason,
            content: response.content,
            toolCallCount: response.toolCalls.length,
            usage: response.usage,
        });

        message.push({
            role: "assistant",
            content: response.content ?? "",
            toolCalls: response.toolCalls.length ? response.toolCalls : undefined,
        });

        const usage = { inputTokens: totalInputTokens, outputTokens: totalOutputTokens };

        if (response.stopReason === "stop") {
            // Jev is optional and advisory: it can request another verification pass,
            // but never executes tools or extends the hard iteration limit.
            if (process.env.TYPESAFE_API_KEY && iteration + 1 < config.maxIterations) {
                try {
                    const decision = await askJev(
                        {
                            task: userInput,
                            recentMessages: message.slice(-8).map((item) => ({
                                role: item.role,
                                content: item.content.slice(0, 4_000),
                                toolName: item.name,
                            })),
                        },
                        {
                            completion: {
                                type: "noul",
                                instructions: "Is the user's coding task demonstrably complete based on the conversation? Return a high probability only when the requested work appears complete and necessary verification evidence is present. A claim of completion alone is not verification.",
                            },
                        },
                    );
                    const probability = decision ? getNoulProbability(decision, "completion") : null;
                    await logEvent("jev_decision", iteration, {
                        model: decision?.model ?? null,
                        question: "completion",
                        completionProbability: probability,
                        action: probability !== null && probability < 0.65 ? "request_verification" : "accept_stop",
                        inputTokens: decision?.inputTokens ?? 0,
                        outputTokens: decision?.outputTokens ?? 0,
                    });
                    if (probability !== null && probability < 0.65) {
                        message.push({
                            role: "user",
                            content: "Before finishing, verify whether the task is actually complete. Inspect your changes and run relevant tests or checks when available. If anything remains incomplete, continue working; do not merely claim success.",
                        });
                        iteration++;
                        continue;
                    }
                } catch (error) {
                    await logEvent("jev_decision", iteration, {
                        error: error instanceof Error ? error.message : String(error),
                        action: "accept_stop_due_to_jev_error",
                    });
                }
            }
            await logEvent("loop_end", iteration, {
                stopReason: "stop", status: "completed", totalIterations: iteration + 1,
            });
            return {
                status: "completed" as const,
                finalContent: response.content ?? "",
                message,
                iteration: iteration + 1,
                stopReason: response.stopReason,
                usage,
            };
        }

        if (response.stopReason === "length") {
            await logEvent("loop_end", iteration, {
                stopReason: "length", status: "incomplete", totalIterations: iteration + 1,
            });
            return {
                status: "incomplete" as const,
                finalContent: response.content ?? "",
                message,
                iteration: iteration + 1,
                stopReason: response.stopReason,
                usage,
            };
        }

        if (response.stopReason === "error") {
            throw new Error("Model returned an error stop reason");
        }

        const results = await executeToolCalls(response.toolCalls, config);
        for (const { call, result } of results) {
            await logEvent("tool_call", iteration, {
                name: call.name,
                arguments: call.arguments,
                result: result.content,
                isError: result.isError,
                durationMs: result.durationMs,
            });
            message.push({
                role: "tool",
                content: result.content,
                toolCallId: result.toolCallId,
                name: result.name,
            });
        }
        iteration++;
    }

    await logEvent("loop_end", iteration, { stopReason: "max-iteration", status: "incomplete", totalIterations: iteration });
    return {
        status: "incomplete" as const,
        finalContent: "",
        message,
        iterations: iteration,
        stopReason: "max-iteration",
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    };
}
