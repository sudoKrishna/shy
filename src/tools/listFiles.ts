import {readdir} from "fs/promises";
import {join} from "path";
import type { ToolDefinition } from "../types";

export const listFilesTool : ToolDefinition = {
    name : "listFiles",
    description : "Lists all files and folders inside a directory . Use this to understand the structure of project before reading specific files.",
    parameters : {
        type : "object",
        properties : {
            dirPath : {
                type :  "string",
                description : "The path to the folder you want to list . Use '.' for the current folder.",
            },
        },
        required : ["dirPath"],
    },
};

export async function runListFile(input  : Record<string , string>) : Promise<string> {
    try {
        const dirPath = input.dirPath ?? ".";
    
        const entries = await readdir(dirPath, {withFileTypes : true});
    
        if(entries.length === 0) {
            return `the folder "${dirPath}" is empty.`;
        }
    
        const lines = entries.map((entry) => {
            const type = entry.isDirectory() ? "[folder]" : "[file]";
            return `${type} ${join(dirPath, entry.name)}`;
        })
    
        return lines.join("\n")
    } catch (error : any) {
        if(error instanceof Error) {
            return `Error listing files : ${error.message}`;
        }
        return "Error : unknown error listing files.";
    }

}