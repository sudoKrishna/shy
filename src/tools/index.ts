import { bashTool } from "./bash";
import { readTool } from "./read";
import { writeTool } from "./write";
import { editTool } from "./edit";
import { grepTool } from "./grep";
import { webFetchTool } from "./web_fetch";
import { globTool } from "./glob";
import type { AgentConfig, ToolDefinition } from "../core/types";
import { createSpawnSubagentTool } from "./spawn_subagent";

export const baseTools : ToolDefinition[] = [bashTool, readTool, writeTool, editTool, grepTool, webFetchTool, globTool];

export function withSubagent(config : AgentConfig) : AgentConfig {
const spawnSubagentTool = createSpawnSubagentTool(config);
return {...config, tools : [...config.tools, spawnSubagentTool]};
}