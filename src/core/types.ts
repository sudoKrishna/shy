export type Role = "system" | "user" |  "assistant" | "tool";

export interface Message {
    role : Role;
    content : string;
    toolCalls? : ToolCall[];
    toolCallId? : string;
    name? : string
}

export interface ToolCall {
    id : string;
    name : string;
    arguments : Record<string, unknown>;
}

export interface ToolResult {
    toolCallId : string;
    name : string;
    content : string;
    isError : boolean;
    durationMs : number;
}

export interface ToolDefinition {
    name : string;
    description :  string;
    parameters : {
        type : "object";
        properties : Record<string , unknown>
        required? : string[]
    }
    execute : (args : Record<string , unknown>) => Promise<string>
}

export interface ModelResponse {
    content : string | null;
    toolCalls : ToolCall[];
    usage : {
        inputTokens : number;
        outputTokens : number;
    };
    stopReason : "stop" | "tool_calls" | "length" | "error";
}

export interface TraceEvent {
    timestamp : string;
    type :  "model_calls" | "tool_call" | "loop_start" | "loop_end" | "error" | "context_compacted";
    iteration : number;
    data : Record<string , unknown>
}

export interface AgentConfig {
    model : string;
    systemPrompt : string;
    tools : ToolDefinition[];
    maxIterations : number;
    maxOutputTokens : number;
    temperature : number;
    maxContextTokens : number;
    compactionThreshold : number;
}
