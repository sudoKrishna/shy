# shy

A coding agent harness built from scratch in TypeScript — the same shape as tools
like Claude Code or Devin: a loop that gives an LLM a set of tools (bash, read,
write, edit, grep), lets it work autonomously toward a task, and traces every
step. Built to actually understand how these systems work, not just use one.

Runs on [Bun](https://bun.com), talks to any OpenAI-compatible chat completions
API (currently wired to DeepSeek).

## Results

**Private eval suite:**

| Iteration | Passed | Avg Quality (Jev) | Avg Tokens | Avg Time |
|---|---|---|---|---|
| Before Jev | 11/11 | — | ~60k/task | ~38s/task |
| After Jev | 11/11 | 3.41/4 | ~7.6k/task | ~7.6s/task |

Same pass rate, but **83% fewer tokens** and **5× faster** per task. Jev stops
the agent the moment the task is verified done instead of letting it loop until
`max-iteration`. Quality scoring now catches what `check.sh` can't — two tasks
that passed the shell check were flagged by Jev as weak solutions
(`008-ambiguous-instruction`: guessed correctly but never reasoned about the
ambiguity; `010-misleading-instruction`: agent was misled by a decoy file but
happened to fix the right thing anyway).

**SWE-bench Lite** (same 18 real GitHub issues, official Docker-based evaluation,
re-run after each round of harness changes — no task-specific tuning):

| Iteration | Resolved | Wrong fix | Gave up (empty patch) |
|---|---|---|---|
| Baseline | 8/18 · 44% | 0 | 9 |
| + context compaction, parallel tool calls, retry/backoff | 10/18 · 56% | 2 | 6 |
| + `glob`, `web_fetch` tools | 12/18 · 67% | 4 | 2 |
| + "verify before done" rule | **12/18 · 67%** | **2** | 4 |
| + Jev decision layer | **12/18 · 67%** | **2** | 4 |

SWE-bench score holds at 12/18 — Jev doesn't change correctness on tasks the
agent was already solving, but token usage per resolved task dropped
significantly. The remaining 6 failures are large-repo navigation problems
(6000+ file Django/matplotlib repos), not a stopping/verification issue.

Two different improvements, two different effects: `glob` mostly fixed
*give-ups* — the agent could finally find the right file in large repos
(Django, matplotlib) instead of guessing paths, so it attempted far more
fixes (16/18 vs 12/18 before). That also meant more *wrong* fixes (4).
Adding an explicit "run the test and read the output before declaring done"
rule to the system prompt cut those wrong fixes back to 2 — same resolved
count, but the agent is now less likely to confidently ship something broken,
even though that shows up as a couple more give-ups instead of bad attempts.

![Project screenshot](image/bench1.png)

Full reports: `swebench/shy-deepseek.shy-verify-rerun.json` (current),
`swebench/shy-deepseek.shy-glob-rerun.json`, `shy-deepseek.shy-rerun-18.json`,
earlier baseline in `swebench/shy-deepseek.shy-bigrun-15.json` +
`shy-deepseek.shy-smoke-test-v2.json`.

## Architecture

```
task ──> system prompt + tools ──> LLM call ──> tool calls?
                 ▲                                  │
                 │                                  ▼
          push results back                   run tools (parallel)
                 ▲     + Jev tool validation        │
                 └──────────────────────────────────┘
                     repeat until Jev confirms done / max iterations
```

- **`src/core/loop.ts`** — the agent loop. Calls the model, executes any tool
  calls it asks for (in parallel via `Promise.all`), feeds results back, repeats.
  Two Jev decision points sit inside the loop:
  - **Stop/continue check** — when DeepSeek returns `stop`, Jev reads the last
    response and recent tool outputs and decides whether the task is genuinely
    done. If Jev says no (e.g. tests haven't been run yet, confidence is low),
    the loop continues despite DeepSeek's signal. This replaced the "verify
    before done" system-prompt rule with a hard programmatic check — cutting
    wrong fixes and eliminating the runaway loop problem where the agent would
    repeat the same final message 15+ times until `max-iteration`.
  - **Tool routing validation** — before executing tool calls, Jev checks whether
    they make sense for the current task. Warnings are logged; the loop continues
    either way, but the signal is visible in the trace.
- **`src/core/llm.ts`** — the only network-touching module. Wraps the OpenAI SDK
  against DeepSeek's compatible endpoint, with retry + exponential backoff on
  transient errors (429 / 5xx / connection timeouts).
- **`src/core/context.ts`** — context compaction. When the running conversation
  approaches a token threshold, Jev decides adaptively whether to compact based
  on what's actually in recent messages (not just a fixed token count). If Jev
  says yes, older messages get summarized into one message by an extra LLM call,
  keeping the last few turns intact.
- **`src/tools/`** — `bash`, `read`, `write`, `edit`, `grep`, `glob`, `web_fetch`.
  Each is a plain `{ name, description, parameters, execute }` object; the loop
  doesn't know or care what a tool does internally. Built on Node's
  `child_process`/`fs` (not Bun-only APIs) so the same harness runs unmodified
  under the Bun CLI and inside Next.js API routes. `bash` blocks destructive
  command patterns before running them; `web_fetch` refuses local/internal
  addresses (SSRF guardrail) and its results are flagged to the model as
  untrusted content in the system prompt.
- **`src/tools/spawn_subagent.ts`** — delegates an independent sub-task to a
  fresh agent with its own clean context and system prompt, returning only a
  short summary to the parent (not the sub-agent's full conversation). Built
  as a factory (`createSpawnSubagentTool(config)`) rather than a static tool
  object, since it needs to build a config for the sub-agent to run inside;
  one level of nesting only — a sub-agent can't spawn one of its own.
- **`src/trace/logger.ts`** — every model call, tool call, compaction event, and
  Jev decision is appended as JSONL to `logs/`, and also broadcast live over an
  in-process event emitter (used by the demo UI). Jev-specific event types:
  `jev_stop_check`, `jev_stop_overridden`, `jev_tool_routing`, `jev_tool_warning`,
  `jev_compact_check`.
- **`src/prompts/system.ts`** — the system prompt: tool-selection rules and
  working-style rules, tuned against the eval suite (see below).
- **`evals/jev-judge.ts`** — Jev-powered eval judge. Runs alongside `check.sh`
  after each task and returns a quality score (0–4), a failure reason
  (`correct`, `wrong_file`, `wrong_logic`, `gave_up`, `no_verification`,
  `mislead_followed`, `partial_fix`, `runtime_error`), a regression flag, and
  a confidence probability. This is what surfaced the two weak-solution tasks
  that `check.sh` passed but Jev correctly flagged.

## What is Jev?

[Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) is a
System One model from TypeSafe AI. Unlike a language model, it doesn't generate
text — it takes unstructured state (a JSON object, a string, anything) and a set
of typed questions, and returns structured decisions with calibrated probabilities.
No hallucination possible: it either picks a choice, assigns a score, or returns
a yes/no probability. Responses arrive in 70–500ms. Input costs $0.042/MTok;
output is free.

This makes it the right tool for the decision layer of an agent loop — not for
generating code or reasoning about a codebase, but for answering "is this task
done?", "do these tool calls make sense?", "should we compact context now?",
"why did this eval fail?". Each of those was previously either a string parsed
from the main LLM (slow, expensive, hallucination-prone) or a hardcoded
threshold (brittle). Jev handles them in ~100ms at near-zero cost.

### What Jev does in shy

**1. Stop/continue decisions (`src/core/loop.ts`)**

When DeepSeek says `stop`, Jev checks:
- Is the task actually complete based on recent tool outputs?
- Has the agent verified the fix (e.g. re-ran the tests)?
- How confident are we?

If Jev isn't satisfied, the loop continues. This replaced a soft system-prompt
rule ("verify before declaring done") with a hard programmatic gate. Before:
the agent would sometimes declare done without running tests, or loop 15 times
repeating the same final message until hitting `max-iteration`. After: the agent
stops exactly once, at the right moment.

BEFORE: stop=max-iteration | 40s | 67,974 tokens (007-fix-bug)
AFTER: stop=stop | 9s | 10,214 tokens

**2. Tool routing validation (`src/core/loop.ts`)**

Before executing tool calls, Jev checks whether they make sense for the task.
Warnings are logged as `jev_tool_warning` events in the trace. Currently
non-blocking (the loop continues either way), but the signal is visible for
debugging.

**3. Adaptive context compaction (`src/core/context.ts`)**

The old compaction trigger was a fixed token threshold. Jev replaces it with an
adaptive check in the 65–95% usage range: it looks at what tools were recently
used, what the last assistant message said, and how many messages are in the
window before deciding whether to compact and how many recent messages to
preserve. Below 65% and above 95% of the threshold it short-circuits without
calling Jev.

**4. Eval judge (`evals/jev-judge.ts`)**

After each eval task, Jev scores the agent's solution independently of
`check.sh`. It returns:
- `patch_correct` — did the agent solve the task?
- `introduces_regression` — does the fix risk breaking something else?
- `quality` — 0–4 score against a rubric
- `failure_reason` — one of 8 labeled categories
- `confidence` — probability of the judgment

This turned a binary pass/fail signal into a diagnostic tool. The failure reason
breakdown across a full eval run tells you exactly what kind of problem to fix
next in the harness.

## Running it

```bash
bun install
echo "DEEPSEEK_API_KEY=..." > .env
echo "TYPESAFE_API_KEY=..." >> .env

bun run start "find all TODOs in src and count them"
```

### Live demo UI

```bash
ln -sf ../.env web/.env   # first time only, so Next.js can see DEEPSEEK_API_KEY
bun run demo
# open http://localhost:3000
```

A Next.js app (`web/`) whose API routes (`web/app/api/run`, `web/app/api/meta`)
import the harness directly and stream every trace event over SSE to the
browser — watch the loop reason, call tools, and answer in real time, with
per-run token/iteration stats.

### Eval suite

```bash
bun run evals/runner.ts

# run a single task
TASK=007-fix-bug bun evals/runner.ts
```

Runs every task in `evals/tasks/`, each in an isolated, cleaned directory, with
an objective pass/fail via a shell exit code (`check.sh`) and a Jev quality
judgment. Results are written to `evals/results/`. This suite is what caught
every real bug in this project — see "What building this actually taught me"
below.

### SWE-bench

```bash
python3 -m venv .swebench-venv && source .swebench-venv/bin/activate
pip install datasets swebench

python3 swebench/select_instances.py 15      # pick N instances from the dataset
deactivate
bun run swebench/run.ts                      # clone repo, run the agent, capture the diff

# run specific instances only
INSTANCES="django__django-16408 sympy__sympy-17139" bun swebench/run.ts

source .swebench-venv/bin/activate
IDS=$(python3 -c "import json; print(' '.join(x['instance_id'] for x in json.load(open('swebench/data/instances.json'))))")
python3 -m swebench.harness.run_evaluation \
  -d SWE-bench/SWE-bench_Lite -p swebench/predictions.jsonl \
  -id my-run -i $IDS --max_workers 4 --report_dir swebench
```

`swebench/run.ts` is the adapter: clone the repo at the issue's base commit,
run `runLoop()` with the issue text as the task, capture `git diff` as the
patch. Evaluation (does the patch actually make the right tests pass) runs
through the official SWE-bench Docker harness, not anything custom.

## What building this actually taught me

The eval suite found real bugs, not synthetic ones:

- **Trace logs polluting eval directories** — the logger used a relative path,
  so once the eval runner `chdir`'d into a task folder, logs got written inside
  it and a `grep`-based check started counting the log file's own output. Fixed
  by capturing the project root before any `chdir`.
- **A timeout that didn't time out** — `proc.kill()` on a `sh -c` wrapper only
  signals `sh`, not the command it spawned; `sh` defers SIGTERM while blocked on
  its child. A `sleep 10` ran the full 10s under a 3s timeout. Fixed by shelling
  out through the `timeout` utility instead, which manages the whole process
  group correctly.
- **The agent doing full filesystem searches** for files already in its working
  directory — added an explicit rule to the system prompt, which dropped one
  eval task's duration from 36s to 5s.
- **Jev being too strict on stop decisions** — initial thresholds (`noul > 0.8`,
  `needs_verification < 0.3`) caused Jev to override correct stops repeatedly,
  burning 15× more tokens than needed. Fixed by passing recent tool outputs into
  the state (so Jev could see test results) and tuning thresholds to
  `noul > 0.65` / `needs_verification < 0.7`. Discovered via debug logging
  — `needs_verification.noul` was consistently 0.57–0.60 even after tests
  passed, because Jev couldn't see the test output without it in the state.


## Project structure

```
src/
core/ agent loop, LLM client, config, types, context compaction
tools/ bash, read, write, edit, grep, glob, web_fetch
trace/ JSONL logger + live event emitter
prompts/ system prompt
evals/
runner.ts isolated-directory eval harness with Jev judgment
jev-judge.ts Jev-powered quality scorer and failure classifier
tasks/ 11 tasks: file I/O, bash, grep, bug-fixing, ambiguity,
misleading instructions, multi-file rename, verify-before-done
swebench/
run.ts agent <-> SWE-bench adapter
select_instances.py dataset sampling
web/ Next.js demo UI
app/api/run/ SSE endpoint — runs the loop, streams trace events
app/api/meta/ system prompt + tool list
app/page.tsx chat/terminal UI
lib/agent.ts shared config, imports the harness from ../src
```
