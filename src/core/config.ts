import type { AgentConfig } from "./types";

export const DEFAULT_MODEL = process.env.MODEL ?? "deepseek-chat";
export const DEFAULT_BASE_URL = process.env.BASE_URL ?? "https://api.deepseek.com";
export const DEFAULT_MAX_ITERATIONS = 25;
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
export const DEFAULT_TEMPERATURE = 0.2;
export const DEFAULT_MAX_CONTEXT_TOKENS = 60000;
export const DEFAULT_COMPACTION_THRESHOLD = 0.7;

export function getApiKey(): string {
    const key = process.env.DEEPSEEK_API_KEY;
    if(!key) {
        throw new Error("Deepseek apikey is not founded")
    }
    return key;
}

export function buildConfig(overrides : Partial<AgentConfig> & Pick<AgentConfig, "systemPrompt" | "tools">) : AgentConfig {
return {
    model : DEFAULT_MODEL,
    maxIterations : DEFAULT_MAX_ITERATIONS,
    maxOutputTokens : DEFAULT_MAX_OUTPUT_TOKENS,
    temperature : DEFAULT_TEMPERATURE,
    maxContextTokens : DEFAULT_MAX_CONTEXT_TOKENS,
    compactionThreshold : DEFAULT_COMPACTION_THRESHOLD,

    ...overrides
}
}