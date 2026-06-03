import {exec } from "child_process";
import { promisify } from "util";
import type { ToolDefinition } from "../types";

const execAsync = promisify(exec);


export const runCommandTool : ToolDefinition = {
    name : "runCommand",
    description : "Runs a terminal command and return the output . Use this to run script , install packages , check  git status , run tests , or any other shell command.",
    parameters : {
        type : "object",
        properties : {
            command : {
                type : "string",
                description : "The terminal command to run , Example : 'npm install' or 'git status or 'ls -la'",
            },
        },
        required : ["command"]
    },
};



export async function runRunCommand(input: Record<string, string>): Promise<string> {
  const command = input.command;
 
  if (!command) {
    return "Error: no command was provided.";
  }
 
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, 
    });
 

    let result = "";
    if (stdout) result += stdout;
    if (stderr) result += `\n[stderr]: ${stderr}`;
 
    return result.trim() || "(command ran but produced no output)";
  } catch (error: unknown) {
    if (error instanceof Error) {
      return `Command failed: ${error.message}`;
    }
    return "Error: unknown error running command.";
  }
}