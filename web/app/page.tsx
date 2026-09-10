"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";

const GITHUB_URL = "https://github.com/sudoKrishna/shy";

const EASE = [0.16, 1, 0.3, 1] as const;

function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StaggerGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.09 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function GridItem({
  children,
  className,
  accent = "#ff4d1c",
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
      }}
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={`group relative overflow-hidden ${className ?? ""}`}
    >
      <span
        aria-hidden
        style={{ background: accent }}
        className="absolute left-0 top-0 h-[3px] w-full origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
      />
      {children}
    </motion.div>
  );
}

function Eyebrow({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] ${
        dark ? "text-[#7a5a45]" : "text-white/70"
      }`}
    >
      <motion.span
        animate={{ opacity: [1, 0.25, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className={`inline-block h-1.5 w-1.5 rounded-full ${dark ? "bg-[#ff4d1c]" : "bg-white"}`}
      />
      {children}
    </div>
  );
}

function AnimatedLink({
  children,
  className,
  arrow,
  ...props
}: React.ComponentProps<typeof Link> & { arrow?: boolean }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className="inline-block"
    >
      <Link className={`group inline-flex items-center gap-2 ${className ?? ""}`} {...props}>
        {children}
        {arrow && (
          <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
            →
          </span>
        )}
      </Link>
    </motion.div>
  );
}

function AnimatedA({
  children,
  className,
  arrow,
  href,
  target,
  rel,
}: {
  children: React.ReactNode;
  className?: string;
  arrow?: boolean;
  href: string;
  target?: string;
  rel?: string;
}) {
  return (
    <motion.a
      href={href}
      target={target}
      rel={rel}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={`group inline-flex items-center gap-2 ${className ?? ""}`}
    >
      {children}
      {arrow && (
        <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
          →
        </span>
      )}
    </motion.a>
  );
}

function CopyBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="group flex w-full items-center justify-between gap-3 border border-white/20 bg-black/15 px-4 py-3 text-left font-mono text-[13px] text-white/90 transition hover:border-white/40 hover:bg-black/25"
    >
      <span className="truncate">
        <span className="text-white/50">$ </span>
        {command}
      </span>
      <span className="relative shrink-0 font-mono text-[10px] uppercase tracking-wider text-white/50 group-hover:text-white">
        <motion.span
          key={copied ? "copied" : "copy"}
          initial={{ opacity: 0, scale: 0.7, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="inline-flex items-center gap-1"
        >
          {copied && <span>✓</span>}
          {copied ? "copied" : "copy"}
        </motion.span>
      </span>
    </motion.button>
  );
}

const pipelineStages = [
  {
    n: "#01",
    file: "core/loop.ts",
    title: "Prompt",
    body: "System prompt + task go in as the first two messages. Tool schemas ride along with every model call.",
  },
  {
    n: "#02",
    file: "core/llm.ts",
    title: "Decide",
    body: "The model either answers directly, or returns one or more tool calls — retried with backoff on transient errors.",
  },
  {
    n: "#03",
    file: "core/loop.ts",
    title: "Execute",
    body: "Independent tool calls run concurrently via Promise.all, not one at a time. Every command is checked against a guardrail list first.",
  },
  {
    n: "#04",
    file: "core/context.ts",
    title: "Compact",
    body: "Once the conversation crosses ~70% of the token budget, older turns get summarized into one message by an extra model call.",
  },
  {
    n: "#05",
    file: "prompts/system.ts",
    title: "Verify",
    body: "Before declaring a fix done, the model is told to actually run it and read the output — not assume it's correct because the diff looks right.",
  },
  {
    n: "#06",
    file: "core/loop.ts",
    title: "Repeat",
    body: "Results feed back in, and the loop continues until the model stops, or a hard iteration ceiling is hit.",
  },
];

const tools = [
  { name: "bash", detail: "Runs shell commands. Blocks destructive patterns (rm -rf /, fork bombs, curl | sh) before they execute." },
  { name: "read", detail: "Reads a file's contents, truncated to a safe output length." },
  { name: "write", detail: "Creates a file or fully overwrites one — never used on files with content worth keeping." },
  { name: "edit", detail: "Replaces one exact string match inside a file. Refuses ambiguous matches instead of guessing." },
  { name: "grep", detail: "Searches text across files with line numbers, instead of the model hand-rolling a search command." },
  { name: "glob", detail: "Finds files by pattern (**/*.py) across the whole tree — no manual recursion, node_modules/.git skipped automatically." },
  { name: "web_fetch", detail: "Fetches a URL and returns its text. Refuses local/internal addresses; its output is flagged as untrusted to the model." },
  { name: "spawn_subagent", detail: "Delegates a sub-task to a fresh agent with clean context. Capped at 5 spawns per run." },
];

const guardrails = [
  { bad: "Destructive commands execute silently", good: "rm -rf /, fork bombs, curl | sh — blocked before they run" },
  { bad: "Sub-agents can spawn without limit", good: "Capped at 5 spawns per run, one level of nesting only" },
  { bad: "web_fetch can reach internal services", good: "localhost, cloud metadata, private IPs — all blocked (SSRF)" },
  { bad: "A fetched page could inject fake instructions", good: "Fetched content is explicitly flagged untrusted — never followed as a command" },
  { bad: "One shared API client for every user", good: "Per-request key isolation — your key never touches another session" },
  { bad: "No abuse protection on the public demo", good: "5 requests / minute, per IP" },
];

const benchStats = [
  { value: "12/18", label: "SWE-bench Lite resolved" },
  { value: "67%", label: "Resolve rate, official harness" },
  { value: "2", label: "Wrong fixes — down from 4" },
  { value: "11/11", label: "Private eval suite passing" },
];

const benchRows = [
  { metric: "Baseline", resolved: "8/18 · 44%", note: "first working agent loop" },
  { metric: "+ compaction, parallel calls, retry", resolved: "10/18 · 56%", note: "context & reliability" },
  { metric: "+ glob, web_fetch", resolved: "12/18 · 67%", note: "codebase navigation" },
  { metric: "+ verify-before-done", resolved: "12/18 · 67%", note: "wrong fixes 4 → 2" },
];

export default function Home() {
  const { scrollYProgress } = useScroll();
  const wordmarkScale = useTransform(scrollYProgress, [0.75, 0.95], [0.9, 1]);
  const wordmarkOpacity = useTransform(scrollYProgress, [0.72, 0.85], [0, 1]);

  return (
    <div className="font-sans">
      {/* NAV */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="sticky top-0 z-50 border-b border-white/15 bg-[#ff4d1c]/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-3">
            <span style={{ fontFamily: "var(--font-serif)" }} className="text-2xl text-white">
              shy
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-white/60 sm:inline">
              coding agent harness
            </span>
          </div>
          <div className="hidden items-center gap-6 font-mono text-[11px] uppercase tracking-[0.14em] text-white/75 md:flex">
            {[
              ["#loop", "Loop"],
              ["#tools", "Tools"],
              ["#guardrails", "Guardrails"],
              ["#benchmark", "Benchmark"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="group relative py-1 hover:text-white">
                {label}
                <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-white transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <AnimatedA
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-white/75 hover:text-white sm:inline"
            >
              GitHub
            </AnimatedA>
            <AnimatedLink
              href="/demo"
              className="bg-white px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[#ff4d1c] transition hover:bg-white/90"
            >
              Try the demo
            </AnimatedLink>
          </div>
        </div>
      </motion.nav>

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#ff4d1c] pb-24 pt-16 text-white">
        <motion.div
          aria-hidden
          animate={{ rotate: 360 }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] opacity-20"
          style={{
            background:
              "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.5) 0deg 1.2deg, transparent 1.2deg 9deg)",
            borderRadius: "9999px",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <Eyebrow>Open source · TypeScript + Bun · DeepSeek-powered</Eyebrow>
          </motion.div>

          <div className="mt-8 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
                style={{ fontFamily: "var(--font-serif)" }}
                className="text-6xl leading-[1.02] sm:text-7xl"
              >
                The agent loop
                <br />
                <span className="italic text-white/90">for your codebase.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
                className="mt-7 max-w-lg text-[15px] leading-relaxed text-white/85"
              >
                shy turns a task into tool calls — bash, read, write, edit, grep, glob,
                web_fetch — runs them in parallel, compacts its own context when it gets
                long, and verifies its own fix before calling it done. Built from scratch
                to understand how coding agents actually work, not just to use one.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.35, ease: EASE }}
                className="mt-9 flex flex-wrap gap-3"
              >
                <AnimatedLink
                  href="/demo"
                  arrow
                  className="bg-white px-5 py-3 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[#ff4d1c] transition hover:bg-white/90"
                >
                  Try the live demo
                </AnimatedLink>
                <AnimatedA
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="border border-white/40 px-5 py-3 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:border-white hover:bg-white/10"
                >
                  Read the source
                </AnimatedA>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.5 }}
                className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/20 pt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70"
              >
                <span>12/18 SWE-bench Lite · 67%</span>
                <span>11/11 evals passing</span>
                <span>8 tools</span>
                <span>0 vendor lock-in</span>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
              className="border border-white/25 bg-black/15"
            >
              <div className="flex items-center justify-between border-b border-white/20 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70">
                <span>Agent loop</span>
                <span>runLoop()</span>
              </div>
              <div className="space-y-3 p-5 font-mono text-[12px] text-white/90">
                {[
                  ["task", "\"fix the failing test\""],
                  ["→ model", "decides: call tool(s)"],
                  ["→ bash", "run test.js"],
                  ["→ edit", "patch math.js"],
                  ["→ bash", "run test.js (parallel-safe)"],
                  ["→ model", "\"fixed. tests pass.\""],
                ].map(([k, v], i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.6 + i * 0.12 }}
                    className="flex items-baseline gap-3 border-b border-white/10 pb-2.5 last:border-0"
                  >
                    <span className="w-20 shrink-0 text-white/50">{k}</span>
                    <span className="truncate">{v}</span>
                  </motion.div>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-white/20 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
                <span>stop reason: stop · iterations: 3</span>
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                  className="inline-block h-3 w-[6px] bg-white/60"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* QUICKSTART */}
      <section className="bg-[#ff4d1c] pb-24 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <Eyebrow>#00 Quickstart</Eyebrow>
            <h2 style={{ fontFamily: "var(--font-serif)" }} className="mt-3 text-4xl sm:text-5xl">
              Running in three commands
            </h2>
          </Reveal>

          <StaggerGrid className="mt-10 grid gap-px overflow-hidden border border-white/20 sm:grid-cols-3">
            {[
              { n: "#01", label: "Install", cmd: "bun install", body: "Pulls the harness, tools, and eval runner." },
              { n: "#02", label: "Configure", cmd: 'echo "DEEPSEEK_API_KEY=..." > .env', body: "Or skip this and paste a key straight into the web demo." },
              { n: "#03", label: "Run", cmd: 'bun run start "fix the bug in math.js"', body: "Same loop, same tools, straight from the terminal." },
            ].map((step) => (
              <GridItem key={step.n} className="bg-[#ff4d1c] p-6" accent="#fff7f0">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">
                  {step.n} {step.label}
                </div>
                <div className="mt-4">
                  <CopyBlock command={step.cmd} />
                </div>
                <p className="mt-4 text-[13px] leading-relaxed text-white/75">{step.body}</p>
              </GridItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* PIPELINE */}
      <section id="loop" className="bg-[#fff7f0] py-24 text-[#221208]">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <Eyebrow dark>#A The agent loop</Eyebrow>
            <h2 style={{ fontFamily: "var(--font-serif)" }} className="mt-3 text-4xl sm:text-5xl">
              Six stages, repeating
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#5c4632]">
              Deterministic where it can be — parallel execution, retry, compaction —
              adaptive where it has to be: what the model decides to call.
            </p>
          </Reveal>

          <StaggerGrid className="mt-12 grid gap-px overflow-hidden border border-[#e7cfb8] bg-[#e7cfb8] sm:grid-cols-2 lg:grid-cols-3">
            {pipelineStages.map((s) => (
              <GridItem key={s.n} className="bg-[#fff7f0] p-7">
                <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-[#b8815e]">
                  <span>{s.n} {s.title}</span>
                </div>
                <div className="mt-1 font-mono text-[10px] text-[#b8815e]/70">{s.file}</div>
                <p className="mt-4 text-[13.5px] leading-relaxed text-[#4a3624]">{s.body}</p>
              </GridItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* TOOLS */}
      <section id="tools" className="bg-[#ff4d1c] py-24 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <Eyebrow>#B The toolset</Eyebrow>
            <h2 style={{ fontFamily: "var(--font-serif)" }} className="mt-3 text-4xl sm:text-5xl">
              Eight tools your agent gets
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/80">
              Each one is a plain object — name, description, JSON-schema parameters,
              an execute function. The loop doesn't know or care what's inside. Grown
              from five to eight as real tasks exposed what was missing.
            </p>
          </Reveal>

          <StaggerGrid className="mt-12 grid gap-px overflow-hidden border border-white/20 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <GridItem key={t.name} className="bg-[#ff4d1c] p-6" accent="#fff7f0">
                <div className="font-mono text-sm font-semibold text-white">{t.name}</div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-white/75">{t.detail}</p>
              </GridItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* GUARDRAILS */}
      <section id="guardrails" className="bg-[#fff7f0] py-24 text-[#221208]">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <Eyebrow dark>#C Safety</Eyebrow>
            <h2 style={{ fontFamily: "var(--font-serif)" }} className="mt-3 text-4xl sm:text-5xl">
              Nothing runs unchecked
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#5c4632]">
              Once a demo takes real API keys from real people, "the model probably
              won't do anything destructive" stops being an acceptable answer.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-12 grid overflow-hidden border border-[#e7cfb8] sm:grid-cols-2">
            <div className="bg-[#f4e4d3] p-8">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#b8815e]">Without guardrails</div>
              <ul className="mt-5 space-y-4">
                {guardrails.map((g) => (
                  <li key={g.bad} className="flex gap-3 border-t border-[#e7cfb8] pt-4 text-[13.5px] leading-relaxed text-[#7a5a45] first:border-0 first:pt-0">
                    <span className="text-[#b8815e]">–</span>
                    {g.bad}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#ff4d1c] p-8 text-white">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/70">shy</div>
              <ul className="mt-5 space-y-4">
                {guardrails.map((g) => (
                  <li key={g.good} className="flex gap-3 border-t border-white/20 pt-4 text-[13.5px] leading-relaxed text-white/90 first:border-0 first:pt-0">
                    <span className="text-white">+</span>
                    {g.good}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* BENCHMARK */}
      <section id="benchmark" className="bg-[#ff4d1c] py-24 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <Eyebrow>#D Official benchmark</Eyebrow>
            <h2 style={{ fontFamily: "var(--font-serif)" }} className="mt-3 text-4xl sm:text-5xl">
              What it actually resolves
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/80">
              SWE-bench Lite, verified through the official Docker-based evaluation
              harness — real GitHub issues, real repos, real test suites. Not a
              self-graded number.
            </p>
          </Reveal>

          <StaggerGrid className="mt-12 grid gap-px overflow-hidden border border-white/20 sm:grid-cols-2 lg:grid-cols-4">
            {benchStats.map((s) => (
              <GridItem key={s.label} className="bg-[#ff4d1c] p-7" accent="#fff7f0">
                <div style={{ fontFamily: "var(--font-serif)" }} className="text-5xl">
                  {s.value}
                </div>
                <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">
                  {s.label}
                </div>
              </GridItem>
            ))}
          </StaggerGrid>

          <Reveal delay={0.1} className="mt-10 overflow-hidden border border-white/20">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/20 font-mono text-[11px] uppercase tracking-[0.12em] text-white/60">
                  <th className="px-5 py-3 font-normal">Iteration</th>
                  <th className="px-5 py-3 font-normal">Resolved</th>
                  <th className="px-5 py-3 font-normal">What changed</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[13px]">
                {benchRows.map((r) => (
                  <tr key={r.metric} className="border-b border-white/10 last:border-0">
                    <td className="px-5 py-3.5 text-white/80">{r.metric}</td>
                    <td className="px-5 py-3.5 font-semibold text-white">{r.resolved}</td>
                    <td className="px-5 py-3.5 text-white/60">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
          <p className="mt-4 font-mono text-[11px] leading-relaxed text-white/50">
            Same 18 instances, re-run after each round of harness changes — no
            task-specific tuning. <b>glob</b> mostly fixed give-ups (agent could
            finally find the right file in big repos); <b>verify-before-done</b>{" "}
            then cut wrong fixes from 4 to 2 without changing the resolved count.
          </p>
        </div>
      </section>

      {/* CLI RUNTIME */}
      <section className="bg-[#fff7f0] py-24 text-[#221208]">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <Eyebrow dark>#E CLI runtime</Eyebrow>
            <h2 style={{ fontFamily: "var(--font-serif)" }} className="mt-3 text-4xl sm:text-5xl">
              What it prints on a real task
            </h2>
          </Reveal>

          <Reveal delay={0.1} className="mt-10 overflow-hidden border border-[#e7cfb8] bg-[#221208]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-white/50">
              <span>~/shy</span>
              <span>real output · not a mockup</span>
            </div>
            <pre className="overflow-x-auto p-6 font-mono text-[12.5px] leading-relaxed text-[#ffcdb0]">
{`$ bun run src/index.ts "count .ts files in src/tools and src/core, delegate each to a sub-agent"

  spawn_subagent → "count .ts files in src/tools"   →  7
  spawn_subagent → "count .ts files in src/core"    →  5

  Both counts are in:
  - src/tools: 7 .ts files
  - src/core: 5 .ts files

stopReason: stop · iterations: 2`}
            </pre>
          </Reveal>
        </div>
      </section>

      {/* DEMO CTA */}
      <section className="bg-[#ff4d1c] py-28 text-white">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <Reveal>
            <Eyebrow>Live demo</Eyebrow>
            <h2 style={{ fontFamily: "var(--font-serif)" }} className="mx-auto mt-4 max-w-2xl text-5xl sm:text-6xl">
              Watch it <span className="italic">think</span>, live.
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-white/80">
              Every model call and tool call streams to the browser over SSE, in
              real time. Bring your own DeepSeek key — it never touches our server.
            </p>
            <AnimatedLink
              href="/demo"
              arrow
              className="mt-9 inline-flex bg-white px-7 py-3.5 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[#ff4d1c] transition hover:bg-white/90"
            >
              Open the demo
            </AnimatedLink>
          </Reveal>
        </div>
      </section>

      {/* WORDMARK */}
      <section className="overflow-hidden bg-[#ff4d1c] pb-16 pt-4 text-white">
        <motion.div
          style={{ scale: wordmarkScale, opacity: wordmarkOpacity, fontFamily: "var(--font-serif)" }}
          className="select-none text-center text-[22vw] italic leading-none"
        >
          shy
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#331705] py-10 text-white/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 font-mono text-[11px] uppercase tracking-[0.12em] sm:flex-row">
          <span>shy · built solo · TypeScript + Bun + Next.js</span>
          <div className="flex gap-6">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-white">Source</a>
            <Link href="/demo" className="hover:text-white">Demo</Link>
            <a href="#benchmark" className="hover:text-white">Benchmark</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
