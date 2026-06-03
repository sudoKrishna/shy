import {readFile} from "fs/promises";
import type { ToolDefinition } from "../types";


export const readFileTool : ToolDefinition = {
    name : "readFile",
    description : "Reads the full contents of a  file and return it as text . Use this when you need to see what is inside a file.",
    parameters : {
        type : "object",
        properties : {
            filePath : {
                type : "string",
                description : "The path to the file you want to read . Example : ./src/index.ts",
            },
        },
        required : ["filePath"]
    },
};

export async function runReadFile(input : Record<string, string>): Promise<string> {
    const filePath = input.filePath;
    if(!filePath) {
        throw new Error("Error : no filePath was provided.")
    }

    try {
        const contents = await readFile(filePath, "utf-8");
        return contents;
    } catch (error : any) {
        if(error instanceof Error) {
            return `Error reading files : ${error.message}`;
        }
        return "Error: unknown error reading file"
    }
}
