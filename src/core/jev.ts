type JevQuestion =
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record<string, string> };

type JevAnswer = {
  type?: string;
  noul?: number;
  choice?: string;
  confidence?: number;
};

type JevResponse = {
  model?: string;
  answers?: Record<string, JevAnswer>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export type JevDecision = {
  model: string;
  answers: Record<string, JevAnswer>;
  inputTokens: number;
  outputTokens: number;
};

const DEFAULT_JEV_MODEL = "jev-latest";
const JEV_TIMEOUT_MS = 5_000;

/**
 * Calls the official TypeSafe Jev endpoint. A missing key disables Jev cleanly;
 * callers decide whether an API failure should fail open or fail the task.
 */
export async function askJev(
  state: unknown,
  questions: Record<string, JevQuestion>,
): Promise<JevDecision | null> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.JEV_MODEL ?? DEFAULT_JEV_MODEL,
      state,
      questions,
    }),
    signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Jev API returned HTTP ${response.status}: ${detail}`);
  }

  const payload = (await response.json()) as JevResponse;
  if (!payload.answers || typeof payload.answers !== "object") {
    throw new Error("Jev API response did not contain an answers object");
  }

  return {
    model: payload.model ?? process.env.JEV_MODEL ?? DEFAULT_JEV_MODEL,
    answers: payload.answers,
    inputTokens: payload.usage?.input_tokens ?? 0,
    outputTokens: payload.usage?.output_tokens ?? 0,
  };
}

export function getNoulProbability(
  decision: JevDecision,
  question: string,
): number | null {
  const value = decision.answers[question]?.noul;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}
