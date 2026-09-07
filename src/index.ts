import { buildConfig } from "./core/config.ts";
import { runLoop } from "./core/loop.ts";
import { allTools } from "./tools/index.ts";

const config = buildConfig({
  systemPrompt:
    "You are a helpful coding assistant. Use the available tools (bash, read, write, edit, grep) when relevant. Use edit instead of write when changing part of an existing file.",
  tools: allTools,
});

async function main() {
  const task = process.argv[2] ?? "search for the word 'export' in the src folder";
  const result = await runLoop(task, config);
  console.log(JSON.stringify(result, null, 2));
}

main();
