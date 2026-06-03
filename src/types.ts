export type Role = "user" | "assistant" | "tool";

// export interface Message {
//     role : Role;
//     content : string
// }

export interface ToolDefinition  {
    name : string;
    description : string;
    parameters : {
        type : "object";
        properties : Record<string , {type  :string, description: string}>;
        required : string[];
    }
}
export type Message = | {
    role : "user";
    content : string;
} | {
    role : "assistant";
    content : string
} | {
    role : "tool";
    content : string;
    tool_call_id : string
}
export interface ToolCall {
    id : string;
    name : string;
    input : Record<string, string>;
}

export interface ToolResult {
    toolCallId : string;
    content : string
}

export type LLMResponse = 
| {type : "text"; content : string}
| {type : "tool_use"; toolCalls : ToolCall[]}

