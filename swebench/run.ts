import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { buildConfig } from "../src/core/config";
import { runLoop } from "../src/core/loop";
import { allTools } from "../src/tools/index";
import { systemPrompt } from "../src/prompts/system";

interface Instance {
  instance_id: string;
  repo: string;
  base_commit: string;
  problem_statement: string;
}

const projectRoot = process.cwd();
const dataPath = join(projectRoot, "swebench/data/instances.json");
const workRoot = join(projectRoot, "swebench/workdirs");
const predictionsPath = join(projectRoot, "swebench/predictions.jsonl");

const instances: Instance[] = JSON.parse(readFileSync(dataPath, "utf-8"));
mkdirSync(workRoot, { recursive: true });

const config = buildConfig({ systemPrompt, tools: allTools });
const predictions: string[] = [];

for (const inst of instances) {
  console.log(`\n=== ${inst.instance_id} ===`);
  const repoDir = join(workRoot, inst.instance_id);

  if (!existsSync(repoDir)) {
    console.log(`cloning ${inst.repo}...`);
    execSync(`git clone https://github.com/${inst.repo}.git "${repoDir}"`, { stdio: "inherit" });
  }

  execSync(`git checkout -f ${inst.base_commit}`, { cwd: repoDir, stdio: "inherit" });
  execSync(`git clean -fd`, { cwd: repoDir, stdio: "inherit" });

  const task =
    `You are working inside the repository "${inst.repo}", already checked out at the commit that has this bug. ` +
    `Find the root cause and fix it by editing the source code. Do not modify test files.\n\n` +
    `Issue:\n${inst.problem_statement}`;

  process.chdir(repoDir);
  let stopReason = "error";
  try {
    const result = await runLoop(task, config);
    stopReason = result.stopReason;
  } catch (err) {
    console.error(`agent failed on ${inst.instance_id}:`, err instanceof Error ? err.message : err);
  } finally {
    process.chdir(projectRoot);
  }

  const diff = execSync(`git diff`, { cwd: repoDir }).toString();
  console.log(`stopReason: ${stopReason}, patch length: ${diff.length} chars`);

  predictions.push(
    JSON.stringify({
      instance_id: inst.instance_id,
      model_patch: diff,
      model_name_or_path: "shy-deepseek",
    })
  );
}

writeFileSync(predictionsPath, predictions.join("\n") + "\n");
console.log(`\nwrote ${predictions.length} predictions to ${predictionsPath}`);
