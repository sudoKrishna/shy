import type { ToolDefinition } from "../core/types";

const MAX_OUTPUT_LENGTH = 5000;
const TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; 

const BLOCKED_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^169\.254\./, // link-local, includes cloud metadata (169.254.169.254)
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
];

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_LENGTH) return text;
  return text.slice(0, MAX_OUTPUT_LENGTH) + "\n...(truncated)";
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const webFetchTool: ToolDefinition = {
  name: "web_fetch",
  description:
    "Fetches a URL over HTTP(S) and returns its text content (HTML tags stripped). " +
    "Use this to read documentation, API references, or public web pages needed to complete a task. " +
    "Cannot access local/internal network addresses.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The full URL to fetch, including http:// or https://.",
      },
    },
    required: ["url"],
  },
  execute: async (args) => {
    const rawUrl = args.url as string;

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return `invalid URL: ${rawUrl}`;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return `blocked: only http:// and https:// URLs are allowed`;
    }

    if (BLOCKED_HOST_PATTERNS.some((p) => p.test(parsed.hostname))) {
      return `blocked: this host looks like a local/internal address and was not fetched`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "shy-agent/1.0" },
      });

      const contentLength = res.headers.get("content-length");
      if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
        return `refused: response too large (${contentLength} bytes)`;
      }

      const contentType = res.headers.get("content-type") ?? "";
      const body = await res.text();

      if (!res.ok) {
        return `HTTP ${res.status} ${res.statusText}\n${truncate(body)}`;
      }

      const text = contentType.includes("text/html") ? htmlToText(body) : body;
      return truncate(text);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return `request timed out after ${TIMEOUT_MS / 1000}s`;
      }
      return `failed to fetch: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      clearTimeout(timeout);
    }
  },
};
