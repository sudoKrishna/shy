import { logEvent } from "../trace/logger";
import { callModel } from "./llm";
import type { AgentConfig, Message, ToolResult } from "./types";

export async function runLoop(userInput : string , config : AgentConfig) {
 const message : Message[] = [
    {role  : "system" , content : config.systemPrompt},
    {role : "user"  , content : userInput}
 ]

 await logEvent("loop_start", 0 , {userInput})
 let iteration = 0;
 while (iteration < config.maxIterations) {
    let response = await callModel(message , config);
     
    await logEvent("model_calls", iteration , {
        stopReason : response.stopReason,
        content  : response.content,
        toolCallCount : response.toolCalls.length,
        usage : response.usage,
    });
    message.push({
        role : "assistant",
        content : response.content ?? "",
        toolCalls : response.toolCalls.length ? response.toolCalls : undefined
    })

    if(response.stopReason === "stop" || response.stopReason === "length") {
        await logEvent("loop_end", iteration, {
            stopReason : response.stopReason,
            totalIterations : iteration + 1,
        });
        return {
            finalContent : response.content ?? "",
            message ,
            iteration : iteration + 1,
            stopReason : response.stopReason
        }
    }

    if(response.stopReason === "error") {
        throw new Error("Model returned an error stop reason")
    }

    for(const call of response.toolCalls){
        const tool = config.tools.find((t) =>  t.name === call.name);
        const startedAt = Date.now();

        let result : ToolResult;
        if(!tool) {
            result = {
                toolCallId : call.id,
                name : call.name,
                content : `no such tool : ${call.name}`,
                isError :true,
                durationMs : Date.now() - startedAt
            }
        } else {
            try {
                const output = await tool.execute(call.arguments)
                result = {
                    toolCallId : call.id,
                    name : call.name,
                    content : output,
                    isError : false,
                    durationMs : Date.now() - startedAt
                }
            } catch (error) {
                result =  {
                    toolCallId : call.id,
                    name : call.name,
                    content : error instanceof Error ? error.message : String(error),
                    isError : true,
                    durationMs : Date.now() - startedAt
                }
            }
        }
        await logEvent("tool_call", iteration, {
            name : call.name,
            arguments : call.arguments,
            result : result.content,
            isError : result.isError,
            durationMs : result.durationMs,
        });

        message.push({
            role : "tool",
            content : result.content,
            toolCallId : result.toolCallId,
            name : result.name
        })
    }
    iteration++;
 }
 await logEvent("loop_end", iteration, {
    stopReason : "max-iteration",
    totalIterations : iteration,
 });
 return {
    finalContent : "",
    message,
    iterations : iteration,
    stopReason :  "max-iteration"

 }
   
}