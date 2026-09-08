"use client";

import { useEffect, useRef, useState } from "react";

type ToolMeta = { name: string; description: string };
type Meta = { model: string; maxIterations: number; systemPrompt: string; tools: ToolMeta[] };

type Block =
  | { kind: "user"; text: string }
  | { kind: "text"; text: string; iteration: number }
  | {
      kind: "tool";
      name: string;
      args: unknown;
      result: string;
      isError: boolean;
      durationMs: number;
      iteration: number;
    }
  | { kind: "compact"; before: number; after: number; iteration: number }
  | { kind: "final"; text: string; stopReason: string }
  | { kind: "error"; text: string };

export default function Home() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [showMeta, setShowMeta] = useState(false);
  const [task, setTask] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({ iterations: 0, toolCalls: 0, tokensIn: 0, tokensOut: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [openTool, setOpenTool] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [blocks]);

  async function runTask() {
    const trimmed = task.trim();
    if (!trimmed || running) return;

    setRunning(true);
    setBlocks([{ kind: "user", text: trimmed }]);
    setStats({ iterations: 0, toolCalls: 0, tokensIn: 0, tokensOut: 0 });
    setTask("");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: trimmed }),
      });

      if (!res.ok || !res.body) {
        setBlocks((b) => [...b, { kind: "error", text: `request failed: ${res.status}` }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          if (!frame.trim()) continue;
          let eventName = "message";
          let dataLine = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event: ")) eventName = line.slice(7).trim();
            if (line.startsWith("data: ")) dataLine = line.slice(6);
          }
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine);
          handleEvent(eventName, payload);
        }
      }
    } catch (err) {
      setBlocks((b) => [
        ...b,
        { kind: "error", text: err instanceof Error ? err.message : String(err) },
      ]);
    } finally {
      setRunning(false);
    }
  }

  function handleEvent(eventName: string, payload: any) {
    if (eventName === "trace") {
      const { type, iteration, data } = payload;

      if (type === "model_calls" && data.content) {
        setBlocks((b) => [...b, { kind: "text", text: data.content, iteration }]);
        setStats((s) => ({
          ...s,
          tokensIn: s.tokensIn + (data.usage?.inputTokens ?? 0),
          tokensOut: s.tokensOut + (data.usage?.outputTokens ?? 0),
        }));
      } else if (type === "model_calls") {
        setStats((s) => ({
          ...s,
          tokensIn: s.tokensIn + (data.usage?.inputTokens ?? 0),
          tokensOut: s.tokensOut + (data.usage?.outputTokens ?? 0),
        }));
      } else if (type === "tool_call") {
        setStats((s) => ({ ...s, toolCalls: s.toolCalls + 1 }));
        setBlocks((b) => [
          ...b,
          {
            kind: "tool",
            name: data.name,
            args: data.arguments,
            result: data.result,
            isError: data.isError,
            durationMs: data.durationMs,
            iteration,
          },
        ]);
      } else if (type === "context_compacted") {
        setBlocks((b) => [
          ...b,
          { kind: "compact", before: data.beforeCount, after: data.afterCount, iteration },
        ]);
      } else if (type === "loop_end") {
        setStats((s) => ({ ...s, iterations: data.totalIterations ?? iteration }));
      }
      return;
    }

    if (eventName === "done") {
      setBlocks((b) => [...b, { kind: "final", text: payload.finalContent, stopReason: payload.stopReason }]);
      return;
    }

    if (eventName === "error") {
      setBlocks((b) => [...b, { kind: "error", text: payload.message }]);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-[#0b0d12] font-mono text-[#e6e8ee]">
      <header className="flex items-center justify-between border-b border-[#242832] px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-semibold tracking-wide">
            <span className="text-[#7dd3fc]">shy</span>
            <span className="text-[#5b606e]"> — agent harness</span>
          </h1>
          {meta && (
            <span className="text-xs text-[#5b606e]">
              {meta.model} · max {meta.maxIterations} iterations
            </span>
          )}
        </div>
        <button
          onClick={() => setShowMeta((v) => !v)}
          className="rounded border border-[#242832] px-2 py-1 text-xs text-[#8a90a0] hover:border-[#7dd3fc] hover:text-[#7dd3fc]"
        >
          {showMeta ? "hide" : "show"} system prompt & tools
        </button>
      </header>

      {showMeta && meta && (
        <div className="border-b border-[#242832] bg-[#12151c] px-5 py-4 text-xs">
          <div className="mb-3 flex flex-wrap gap-2">
            {meta.tools.map((t) => (
              <span
                key={t.name}
                title={t.description}
                className="rounded bg-[#171b24] border border-[#242832] px-2 py-1 text-[#a78bfa]"
              >
                {t.name}
              </span>
            ))}
          </div>
          <pre className="whitespace-pre-wrap text-[#8a90a0]">{meta.systemPrompt}</pre>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {blocks.length === 0 && (
          <p className="text-sm text-[#5b606e]">
            $ enter a task below and watch the agent work — every model call and tool call
            streams here live.
          </p>
        )}

        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {blocks.map((block, i) => (
            <BlockView key={i} block={block} open={openTool === i} onToggle={() => setOpenTool(openTool === i ? null : i)} />
          ))}
        </div>
      </div>

      <div className="border-t border-[#242832] px-5 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="text-[#7dd3fc]">›</span>
          <input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runTask()}
            disabled={running}
            placeholder="e.g. find all TODOs in src and write the count to count.txt"
            className="flex-1 bg-transparent text-sm text-[#e6e8ee] outline-none placeholder:text-[#3f4552] disabled:opacity-50"
          />
          <button
            onClick={runTask}
            disabled={running || !task.trim()}
            className="rounded bg-[#7dd3fc] px-3 py-1.5 text-xs font-semibold text-[#06202b] disabled:bg-[#242832] disabled:text-[#5b606e]"
          >
            {running ? "running…" : "run"}
          </button>
        </div>
        <div className="mx-auto mt-2 flex max-w-3xl gap-4 pl-6 text-[11px] text-[#5b606e]">
          <span>iterations: {stats.iterations}</span>
          <span>tool calls: {stats.toolCalls}</span>
          <span>
            tokens: {stats.tokensIn}/{stats.tokensOut}
          </span>
        </div>
      </div>
    </div>
  );
}

function BlockView({
  block,
  open,
  onToggle,
}: {
  block: Block;
  open: boolean;
  onToggle: () => void;
}) {
  if (block.kind === "user") {
    return (
      <div className="text-sm">
        <span className="text-[#7dd3fc]">›</span> <span className="text-[#e6e8ee]">{block.text}</span>
      </div>
    );
  }

  if (block.kind === "text") {
    return (
      <div className="pl-4 text-sm text-[#c3c7d1]">
        <span className="text-[#5b606e]">●</span> {block.text}
      </div>
    );
  }

  if (block.kind === "final") {
    return (
      <div className="mt-1 rounded border border-[#1f3b30] bg-[#12191590] px-3 py-2 text-sm text-[#34d399]">
        {block.text || <span className="text-[#5b606e]">(no final message — {block.stopReason})</span>}
      </div>
    );
  }

  if (block.kind === "compact") {
    return (
      <div className="pl-4 text-xs text-[#a78bfa]">
        ↺ context compacted — {block.before} → {block.after} messages
      </div>
    );
  }

  if (block.kind === "error") {
    return <div className="pl-4 text-sm text-[#f87171]">✕ {block.text}</div>;
  }

  // tool
  const badgeColor = block.isError ? "text-[#f87171]" : "text-[#34d399]";
  return (
    <div className="pl-4">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-[#12151c]"
      >
        <span className={badgeColor}>{block.isError ? "✕" : "●"}</span>
        <span className="text-[#a78bfa]">{block.name}</span>
        <span className="text-[#5b606e]">({block.durationMs}ms)</span>
      </button>
      {open && (
        <div className="ml-5 mt-1 rounded border border-[#242832] bg-[#12151c] p-2 text-xs">
          <div className="mb-1 text-[#5b606e]">arguments</div>
          <pre className="whitespace-pre-wrap break-words text-[#c3c7d1]">
            {JSON.stringify(block.args, null, 2)}
          </pre>
          <div className="mb-1 mt-2 text-[#5b606e]">result</div>
          <pre className="whitespace-pre-wrap break-words text-[#c3c7d1]">{block.result}</pre>
        </div>
      )}
    </div>
  );
}
