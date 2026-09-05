import { bashTool } from "./bash";
import { readTool } from "./read";
import { writeTool } from "./write";
import { editTool } from "./edit";
import { grepTool } from "./grep";
import type { ToolDefinition } from "../core/types";

export const allTools: ToolDefinition[] = [bashTool, readTool, writeTool, editTool, grepTool];
