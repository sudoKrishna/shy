import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AgentConfig, ModelResponse, ToolDefinition } from "./types";

let responses: ModelResponse[] = [];
const callModel = mock(async () => {
    const next = responses.shift();
    if (!next) throw new Error("No mocked model response available");
    return next;
});

mock.module("./llm", () => ({ callModel }));
mock.module("../trace/logger", () => ({ logEvent: mock(async () => {}) }));
mock.module("./context", () => ({
    shouldCompact: () => false,
    compactMessages: async (messages: unknown[]) => ({
        messages, beforeCount: messages.length, afterCount: messages.length,
    }),
}));

const { runLoop } = await import("./loop");

function response(stopReason: ModelResponse["stopReason"], content: string | null = "", toolCalls: ModelResponse["toolCalls"] = []): ModelResponse {
    return {
        stopReason, content, toolCalls,
        usage: { inputTokens: 10, outputTokens: 2 },
    };
}

function config(tools: ToolDefinition[] = []): AgentConfig {
    return {
        model: "test-model",
        systemPrompt: "test",
        tools,
        maxIterations: 5,
        maxOutputTokens: 100,
        temperature: 0,
        maxContextTokens: 1000,
        compactionThreshold: 0.7,
    };
}

beforeEach(() => {
    responses = [];
    callModel.mockClear();
});

describe("runLoop completion status", () => {
    test("reports stop as completed", async () => {
        responses = [response("stop", "Done")];
        const result = await runLoop("task", config());
        expect(result.status).toBe("completed");
        expect(result.stopReason).toBe("stop");
    });

    test("reports output truncation as incomplete", async () => {
        responses = [response("length", "Partial output")];
        const result = await runLoop("task", config());
        expect(result.status).toBe("incomplete");
        expect(result.stopReason).toBe("length");
        expect(result.finalContent).toBe("Partial output");
    });

    test("reports iteration exhaustion as incomplete", async () => {
        responses = [
            response("tool_calls", "", []),
            response("tool_calls", "", []),
        ];
        const result = await runLoop("task", { ...config(), maxIterations: 2 });
        expect(result.status).toBe("incomplete");
        expect(result.stopReason).toBe("max-iteration");
    });
});

describe("tool conflict scheduling", () => {
    test("serializes writes to the same file", async () => {
        let activeWrites = 0;
        let maxActiveWrites = 0;
        const write: ToolDefinition = {
            name: "write",
            description: "test write",
            parameters: { type: "object", properties: {} },
            execute: async () => {
                activeWrites++;
                maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
                await new Promise((resolve) => setTimeout(resolve, 10));
                activeWrites--;
                return "written";
            },
        };
        responses = [
            response("tool_calls", "", [
                { id: "1", name: "write", arguments: { filePath: "same.ts", content: "a" } },
                { id: "2", name: "write", arguments: { filePath: "same.ts", content: "b" } },
            ]),
            response("stop", "Done"),
        ];
        await runLoop("task", config([write]));
        expect(maxActiveWrites).toBe(1);
    });

    test("runs writes to different files concurrently", async () => {
        let activeWrites = 0;
        let maxActiveWrites = 0;
        const write: ToolDefinition = {
            name: "write",
            description: "test write",
            parameters: { type: "object", properties: {} },
            execute: async () => {
                activeWrites++;
                maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
                await new Promise((resolve) => setTimeout(resolve, 10));
                activeWrites--;
                return "written";
            },
        };
        responses = [
            response("tool_calls", "", [
                { id: "1", name: "write", arguments: { filePath: "a.ts", content: "a" } },
                { id: "2", name: "write", arguments: { filePath: "b.ts", content: "b" } },
            ]),
            response("stop", "Done"),
        ];
        await runLoop("task", config([write]));
        expect(maxActiveWrites).toBe(2);
    });
});
