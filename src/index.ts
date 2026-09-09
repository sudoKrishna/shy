import { buildConfig } from "./core/config.ts";
import { runLoop } from "./core/loop.ts";
import { baseTools, withSubagent } from "./tools/index.ts";
import { systemPrompt } from "./prompts/system.ts";

const config = withSubagent(
  buildConfig({
    systemPrompt,
    tools: baseTools,
  })
);

async function main() {
  const task = process.argv[2] ?? "search for the word 'export' in the src folder";
  const result = await runLoop(task, config);
  console.log(JSON.stringify(result, null, 2));
}

main();
